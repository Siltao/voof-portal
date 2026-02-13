// ========================================
// VOOF - Sistema Administrativo v2
// Com edição, permissões e gerenciamento
// ========================================

// CONFIGURAÇÃO - SUBSTITUA PELAS SUAS CREDENCIAIS
const SUPABASE_URL = 'https://lbvtpawkufemglkaepqb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxidnRwYXdrdWZlbWdsa2FlcHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NDg2MTksImV4cCI6MjA4NjIyNDYxOX0.knLhtuTd0DekAMFwlC3QjapFjEiXmcuuWG4AstzxoKQ';

if (typeof window.voofSupabase === 'undefined') {
    window.voofSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const supabaseClient = window.voofSupabase;
let currentUser = null;
let currentUserPermissions = null;
let editingPostId = null;

// ========================================
// SISTEMA DE PERMISSÕES
// ========================================

async function loadUserPermissions() {
    try {
        const { data, error } = await supabaseClient
            .from('user_permissions')
            .select('*')
            .eq('user_id', currentUser.id)
            .single();

        if (error) {
            const { data: newPerm, error: createError } = await supabaseClient
                .from('user_permissions')
                .insert([{
                    user_id: currentUser.id,
                    email: currentUser.email,
                    role: 'writer',
                    display_name: currentUser.email.split('@')[0]
                }])
                .select()
                .single();

            if (createError) throw createError;
            currentUserPermissions = newPerm;
        } else {
            currentUserPermissions = data;
        }

        console.log('Permissões:', currentUserPermissions);
        updateUIBasedOnPermissions();
    } catch (error) {
        console.error('Erro ao carregar permissões:', error);
    }
}

function isAdmin() {
    return currentUserPermissions && currentUserPermissions.role === 'admin';
}

function updateUIBasedOnPermissions() {
    const usersTab = document.getElementById('users-tab');
    if (usersTab) {
        usersTab.style.display = isAdmin() ? 'block' : 'none';
    }

    const userNameEl = document.getElementById('user-name');
    if (userNameEl && currentUserPermissions) {
        const roleBadge = isAdmin() ? '👑 Admin' : '✍️ Escritor';
        userNameEl.innerHTML = `${currentUserPermissions.display_name || currentUser.email} <span style="margin-left: 0.5rem; font-size: 0.8rem; opacity: 0.7;">${roleBadge}</span>`;
    }
}

// ========================================
// AUTENTICAÇÃO
// ========================================

async function checkAuth() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        if (user) {
            currentUser = user;
            await loadUserPermissions();
            showAdminPanel();
            loadPendingPosts();
        } else {
            showLoginScreen();
        }
    } catch (error) {
        console.error('Error checking auth:', error);
        showLoginScreen();
    }
}

function showLoginScreen() {
    document.getElementById('login-screen').style.display = 'block';
    document.getElementById('admin-panel').style.display = 'none';
}

function showAdminPanel() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
}

async function login(email, password) {
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;
        if (!data.user) throw new Error('Login não retornou usuário');

        currentUser = data.user;
        await loadUserPermissions();
        showAdminPanel();
        loadPendingPosts();
        showAlert('login-alert', 'Login realizado com sucesso!', 'success');
    } catch (error) {
        console.error('Login error:', error);
        let errorMessage = error.message;
        if (error.message.includes('Invalid login credentials')) {
            errorMessage = 'Email ou senha incorretos';
        }
        showAlert('login-alert', 'Erro: ' + errorMessage, 'error');
    }
}

async function logout() {
    try {
        await supabaseClient.auth.signOut();
        currentUser = null;
        currentUserPermissions = null;
        showLoginScreen();
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// ========================================
// POSTS - LISTAGEM
// ========================================

async function loadPendingPosts() {
    try {
        const { data, error } = await supabaseClient
            .from('posts')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) throw error;
        renderPosts('pending-posts', data || [], 'pending');
    } catch (error) {
        console.error('Error loading pending posts:', error);
        document.getElementById('pending-posts').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📝</div>
                <p class="empty-state-text">Nenhum post pendente de aprovação</p>
            </div>
        `;
    }
}

async function loadApprovedPosts() {
    try {
        const { data, error } = await supabaseClient
            .from('posts')
            .select('*')
            .eq('status', 'approved')
            .order('created_at', { ascending: false });

        if (error) throw error;
        renderPosts('approved-posts', data || [], 'approved');
    } catch (error) {
        console.error('Error loading approved posts:', error);
        document.getElementById('approved-posts').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📰</div>
                <p class="empty-state-text">Nenhum post publicado ainda</p>
            </div>
        `;
    }
}

function renderPosts(containerId, posts, status) {
    const container = document.getElementById(containerId);
    
    if (posts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">${status === 'pending' ? '📝' : '📰'}</div>
                <p class="empty-state-text">
                    ${status === 'pending' ? 'Nenhum post pendente' : 'Nenhum post publicado'}
                </p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="posts-grid">
            ${posts.map(post => {
                const canEdit = isAdmin() || (post.author === currentUser.email.split('@')[0] && status === 'pending');
                const canDelete = isAdmin();
                
                return `
                <div class="post-card">
                    <img src="${post.cover_image || 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400'}" 
                         alt="${post.title}" 
                         class="post-image">
                    <div class="post-content">
                        <span class="post-category">${post.category}</span>
                        <h3 class="post-title">${post.title}</h3>
                        <p class="post-description">${post.short_description}</p>
                        <div class="post-meta">
                            <span>👤 ${post.author || 'Anônimo'}</span>
                            ${post.co_authors && post.co_authors.length > 0 ? `<span>+${post.co_authors.length}</span>` : ''}
                            <span class="post-status ${status === 'pending' ? 'status-pending' : 'status-approved'}">
                                ${status === 'pending' ? 'Pendente' : 'Publicado'}
                            </span>
                        </div>
                        ${post.scheduled_publish_at ? `
                            <div style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--accent-warning);">
                                📅 Agendado: ${formatDateTime(post.scheduled_publish_at)}
                            </div>
                        ` : ''}
                        <div class="post-actions">
                            ${status === 'pending' && isAdmin() ? `
                                <button class="btn btn-primary btn-small" onclick="approvePost('${post.id}')">
                                    ✓ Aprovar
                                </button>
                            ` : ''}
                            ${canEdit ? `
                                <button class="btn btn-secondary btn-small" onclick="editPost('${post.id}')">
                                    ✏️ Editar
                                </button>
                            ` : ''}
                            ${canDelete ? `
                                <button class="btn btn-danger btn-small" onclick="deletePost('${post.id}')">
                                    🗑️ Excluir
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
                `;
            }).join('')}
        </div>
    `;
}

// ========================================
// POSTS - AÇÕES
// ========================================

async function approvePost(postId) {
    if (!isAdmin()) {
        alert('Apenas administradores podem aprovar posts');
        return;
    }

    if (!confirm('Deseja aprovar este post?')) return;

    try {
        const { error } = await supabaseClient
            .from('posts')
            .update({ 
                status: 'approved',
                published_at: new Date().toISOString()
            })
            .eq('id', postId);

        if (error) throw error;

        alert('Post aprovado com sucesso!');
        loadPendingPosts();
        loadApprovedPosts();
    } catch (error) {
        console.error('Error approving post:', error);
        alert('Erro ao aprovar post: ' + error.message);
    }
}

async function deletePost(postId) {
    if (!isAdmin()) {
        alert('Apenas administradores podem deletar posts');
        return;
    }

    if (!confirm('Deseja realmente excluir este post? Esta ação não pode ser desfeita.')) return;

    try {
        const { error } = await supabaseClient
            .from('posts')
            .delete()
            .eq('id', postId);

        if (error) throw error;

        alert('Post excluído com sucesso!');
        loadPendingPosts();
        loadApprovedPosts();
    } catch (error) {
        console.error('Error deleting post:', error);
        alert('Erro ao excluir post: ' + error.message);
    }
}

async function editPost(postId) {
    try {
        const { data, error } = await supabaseClient
            .from('posts')
            .select('*')
            .eq('id', postId)
            .single();

        if (error) throw error;

        editingPostId = postId;
        
        // Preencher formulário
        document.getElementById('post-id').value = postId;
        document.getElementById('post-category').value = data.category;
        document.getElementById('post-title').value = data.title;
        document.getElementById('post-short-desc').value = data.short_description;
        document.getElementById('post-full-text').value = data.full_text;
        document.getElementById('post-cover-image').value = data.cover_image;
        document.getElementById('post-gallery-images').value = data.gallery_images ? data.gallery_images.join('\n') : '';
        document.getElementById('post-co-authors').value = data.co_authors ? data.co_authors.join(', ') : '';
        document.getElementById('post-scheduled').value = data.scheduled_publish_at ? formatDateTimeInput(data.scheduled_publish_at) : '';
        document.getElementById('post-editor-notes').value = data.editor_notes || '';

        // Atualizar UI
        document.getElementById('form-title').textContent = 'Editar Notícia';
        document.getElementById('submit-btn').textContent = 'Salvar Alterações';
        document.getElementById('cancel-edit-btn').style.display = 'inline-block';

        // Mudar para aba de criar/editar
        switchTab('create');
        window.scrollTo(0, 0);
    } catch (error) {
        console.error('Error loading post:', error);
        alert('Erro ao carregar post: ' + error.message);
    }
}

function cancelEdit() {
    editingPostId = null;
    document.getElementById('post-id').value = '';
    document.getElementById('create-post-form').reset();
    document.getElementById('form-title').textContent = 'Criar Nova Notícia';
    document.getElementById('submit-btn').textContent = 'Publicar Notícia';
    document.getElementById('cancel-edit-btn').style.display = 'none';
}

async function createOrUpdatePost(postData) {
    try {
        const postId = document.getElementById('post-id').value;
        
        if (postId) {
            // Atualizar
            const { error } = await supabaseClient
                .from('posts')
                .update(postData)
                .eq('id', postId);

            if (error) throw error;

            showAlert('create-alert', 'Notícia atualizada com sucesso!', 'success');
            cancelEdit();
        } else {
            // Criar novo
            const { error } = await supabaseClient
                .from('posts')
                .insert([postData]);

            if (error) throw error;

            showAlert('create-alert', 'Notícia criada com sucesso!', 'success');
            document.getElementById('create-post-form').reset();
        }

        setTimeout(() => {
            loadPendingPosts();
            loadApprovedPosts();
        }, 1000);
    } catch (error) {
        console.error('Error creating/updating post:', error);
        showAlert('create-alert', 'Erro: ' + error.message, 'error');
    }
}

// Continua...

// ========================================
// GERENCIAMENTO DE USUÁRIOS
// ========================================

async function loadUsers() {
    if (!isAdmin()) return;

    try {
        const { data, error } = await supabaseClient
            .from('user_permissions')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        renderUsers(data || []);
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function renderUsers(users) {
    const container = document.getElementById('users-list');
    
    if (users.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">👥</div>
                <p class="empty-state-text">Nenhum usuário cadastrado</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <table class="users-table">
            <thead>
                <tr>
                    <th>Email</th>
                    <th>Nome</th>
                    <th>Função</th>
                    <th>Criado em</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
                ${users.map(user => `
                    <tr>
                        <td>${user.email}</td>
                        <td>${user.display_name || '-'}</td>
                        <td>
                            <span class="role-badge ${user.role === 'admin' ? 'role-admin' : 'role-writer'}">
                                ${user.role === 'admin' ? '👑 Admin' : '✍️ Escritor'}
                            </span>
                        </td>
                        <td>${formatDate(user.created_at)}</td>
                        <td>
                            ${user.user_id !== currentUser.id ? `
                                ${user.role === 'writer' ? `
                                    <button class="btn btn-primary btn-small" onclick="promoteUser('${user.user_id}')">
                                        ⬆️ Promover
                                    </button>
                                ` : `
                                    <button class="btn btn-warning btn-small" onclick="demoteUser('${user.user_id}')">
                                        ⬇️ Rebaixar
                                    </button>
                                `}
                                <button class="btn btn-danger btn-small" onclick="deleteUser('${user.user_id}')">
                                    🗑️ Remover
                                </button>
                            ` : '<span style="color: var(--text-dim);">Você</span>'}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function promoteUser(userId) {
    if (!isAdmin()) {
        alert('Apenas administradores podem promover usuários');
        return;
    }

    if (!confirm('Deseja promover este usuário a Administrador?')) return;

    try {
        const { error } = await supabaseClient
            .from('user_permissions')
            .update({ role: 'admin' })
            .eq('user_id', userId);

        if (error) throw error;

        alert('Usuário promovido com sucesso!');
        loadUsers();
    } catch (error) {
        console.error('Error promoting user:', error);
        alert('Erro ao promover usuário: ' + error.message);
    }
}

async function demoteUser(userId) {
    if (!isAdmin()) {
        alert('Apenas administradores podem rebaixar usuários');
        return;
    }

    if (!confirm('Deseja rebaixar este administrador a Escritor?')) return;

    try {
        const { error } = await supabaseClient
            .from('user_permissions')
            .update({ role: 'writer' })
            .eq('user_id', userId);

        if (error) throw error;

        alert('Usuário rebaixado com sucesso!');
        loadUsers();
    } catch (error) {
        console.error('Error demoting user:', error);
        alert('Erro ao rebaixar usuário: ' + error.message);
    }
}

async function deleteUser(userId) {
    if (!isAdmin()) {
        alert('Apenas administradores podem deletar usuários');
        return;
    }

    if (!confirm('Deseja realmente remover este usuário? Esta ação não pode ser desfeita.')) return;

    try {
        // Primeiro deletar da tabela user_permissions
        const { error: permError } = await supabaseClient
            .from('user_permissions')
            .delete()
            .eq('user_id', userId);

        if (permError) throw permError;

        alert('Usuário removido com sucesso!');
        loadUsers();
    } catch (error) {
        console.error('Error deleting user:', error);
        alert('Erro ao remover usuário: ' + error.message);
    }
}

function showAddUserModal() {
    document.getElementById('add-user-modal').classList.add('active');
}

function closeAddUserModal() {
    document.getElementById('add-user-modal').classList.remove('active');
    document.getElementById('add-user-form').reset();
    document.getElementById('add-user-alert').innerHTML = '';
}

async function addNewUser(email, password, displayName, role) {
    try {
        // Note: This creates the auth user via Supabase Admin API
        // In a real app, you'd need to use Supabase Admin SDK or a backend function
        // For now, we'll show a message
        showAlert('add-user-alert', 'IMPORTANTE: Para criar usuários, use o Supabase Authentication > Users > Add User. Depois, você pode gerenciar as funções aqui.', 'error');
        
        // Alternative: Just add to permissions table if user already exists
        // This is a workaround - ideally you'd create the auth user too
        
    } catch (error) {
        console.error('Error adding user:', error);
        showAlert('add-user-alert', 'Erro ao adicionar usuário: ' + error.message, 'error');
    }
}

// ========================================
// UTILIDADES
// ========================================

function showAlert(containerId, message, type) {
    const container = document.getElementById(containerId);
    container.innerHTML = `
        <div class="alert alert-${type}">
            ${message}
        </div>
    `;
    
    setTimeout(() => {
        container.innerHTML = '';
    }, 5000);
}

function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    const targetTab = document.querySelector(`[data-tab="${tabName}"]`);
    if (targetTab) {
        targetTab.classList.add('active');
    }

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    const contentId = tabName === 'users' ? 'users-tab-content' : `${tabName}-tab`;
    const targetContent = document.getElementById(contentId);
    if (targetContent) {
        targetContent.classList.add('active');
    }

    if (tabName === 'pending') {
        loadPendingPosts();
    } else if (tabName === 'approved') {
        loadApprovedPosts();
    } else if (tabName === 'users') {
        loadUsers();
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR');
}

function formatDateTimeInput(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// ========================================
// INICIALIZAÇÃO
// ========================================

async function init() {
    await checkAuth();

    // Event listeners
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        await login(email, password);
    });

    document.getElementById('logout-btn').addEventListener('click', logout);

    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;
            if (tabName) {
                switchTab(tabName);
            }
        });
    });

    document.getElementById('create-post-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const galleryImagesText = document.getElementById('post-gallery-images').value;
        const galleryImages = galleryImagesText
            .split('\n')
            .map(url => url.trim())
            .filter(url => url.length > 0);

        const coAuthorsText = document.getElementById('post-co-authors').value;
        const coAuthors = coAuthorsText
            .split(',')
            .map(email => email.trim())
            .filter(email => email.length > 0);

        const scheduledPublish = document.getElementById('post-scheduled').value;
        

const categoriesSelect = document.getElementById('post-categories');
const selectedCategories = categoriesSelect ? 
    Array.from(categoriesSelect.selectedOptions).map(o => o.value).slice(0, 3) :
    [document.getElementById('post-category')?.value || 'tecnologia'];
        const postData = {
    categories: selectedCategories,
    category: selectedCategories[0], // Compatibilidade
    post_type: document.getElementById('post-type')?.value || 'text',
    video_url: document.getElementById('post-video-url')?.value || null,
    title: document.getElementById('post-title').value,
    short_description: document.getElementById('post-short-desc').value,
    full_text: document.getElementById('post-full-text').value,
    cover_image: document.getElementById('post-cover-image')?.value || null,
    gallery_images: galleryImages.length > 0 ? galleryImages : null,
    co_authors: coAuthors.length > 0 ? coAuthors : null,
    scheduled_publish_at: scheduledPublish || null,
    editor_notes: document.getElementById('post-editor-notes')?.value || null,
    author: currentUserPermissions?.display_name || currentUser.email.split('@')[0],
    status: isAdmin() ? 'approved' : 'pending', // IMPORTANTE!
    created_at: new Date().toISOString()
};

if (isAdmin() && !scheduledPublish) {
    postData.published_at = new Date().toISOString();
}

        await createOrUpdatePost(postData);
    });

    document.getElementById('add-user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('new-user-email').value;
        const password = document.getElementById('new-user-password').value;
        const displayName = document.getElementById('new-user-display-name').value;
        const role = document.getElementById('new-user-role').value;
        await addNewUser(email, password, displayName, role);
    });
}

// Funções globais
window.approvePost = approvePost;
window.deletePost = deletePost;
window.editPost = editPost;
window.cancelEdit = cancelEdit;
window.promoteUser = promoteUser;
window.demoteUser = demoteUser;
window.deleteUser = deleteUser;
window.showAddUserModal = showAddUserModal;
window.closeAddUserModal = closeAddUserModal;

// Start app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
