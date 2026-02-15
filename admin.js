// ========================================
// VOOF Admin v2 - Sistema Completo
// ========================================

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
// PERMISSÕES
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

    const analyticsTab = document.getElementById('analytics-tab');
    if (analyticsTab) {
        analyticsTab.style.display = isAdmin() ? 'block' : 'none';
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
        showAlert('login-alert', 'Login realizado!', 'success');
    } catch (error) {
        console.error('Login error:', error);
        let errorMessage = error.message.includes('Invalid login credentials') 
            ? 'Email ou senha incorretos' 
            : error.message;
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
                <p class="empty-state-text">Nenhum post pendente</p>
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
                <p class="empty-state-text">Nenhum post publicado</p>
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
                const categories = post.categories || [post.category];
                
                return `
                <div class="post-card">
                    ${post.post_type === 'video' ? `
                        <video src="${post.video_url}" class="post-image" muted></video>
                    ` : `
                        <img src="${post.cover_image || 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400'}" 
                             alt="${post.title}" 
                             class="post-image">
                    `}
                    <div class="post-content">
                        <span class="post-category">${categories[0]}</span>
                        ${categories.length > 1 ? `<span class="post-category" style="opacity: 0.7; font-size: 0.7rem;">+${categories.length - 1}</span>` : ''}
                        <h3 class="post-title">${post.title}</h3>
                        <p class="post-description">${post.short_description}</p>
                        <div class="post-meta">
                            <span>👤 ${post.author || 'Anônimo'}</span>
                            ${post.co_authors && post.co_authors.length > 0 ? `<span>+${post.co_authors.length}</span>` : ''}
                            <span class="post-status ${status === 'pending' ? 'status-pending' : 'status-approved'}">
                                ${status === 'pending' ? 'Pendente' : 'Publicado'}
                            </span>
                        </div>
                        ${isAdmin() && post.view_count ? `
                            <div style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--accent-primary);">
                                👁️ ${post.view_count} visualizações
                            </div>
                        ` : ''}
                        ${post.scheduled_publish_at ? `
                            <div style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--accent-warning);">
                                📅 ${formatDateTime(post.scheduled_publish_at)}
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
    if (!isAdmin()) return alert('Apenas administradores podem aprovar');
    if (!confirm('Aprovar este post?')) return;

    try {
        const { error } = await supabaseClient
            .from('posts')
            .update({ 
                status: 'approved',
                published_at: new Date().toISOString()
            })
            .eq('id', postId);

        if (error) throw error;

        alert('Post aprovado!');
        loadPendingPosts();
        loadApprovedPosts();
    } catch (error) {
        console.error('Error:', error);
        alert('Erro ao aprovar: ' + error.message);
    }
}

async function deletePost(postId) {
    if (!isAdmin()) return alert('Apenas administradores podem deletar');
    if (!confirm('Deletar este post? Não pode ser desfeito!')) return;

    try {
        const { error } = await supabaseClient
            .from('posts')
            .delete()
            .eq('id', postId);

        if (error) throw error;

        alert('Post excluído!');
        loadPendingPosts();
        loadApprovedPosts();
    } catch (error) {
        console.error('Error:', error);
        alert('Erro ao excluir: ' + error.message);
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
        
        document.getElementById('post-id').value = postId;
        document.getElementById('post-type').value = data.post_type || 'text';
        
        // Categorias
        const categoriesSelect = document.getElementById('post-categories');
        const categories = data.categories || [data.category];
        Array.from(categoriesSelect.options).forEach(option => {
            option.selected = categories.includes(option.value);
        });
        
        document.getElementById('post-title').value = data.title;
        document.getElementById('post-short-desc').value = data.short_description;
        document.getElementById('post-full-text').value = data.full_text;
        document.getElementById('post-cover-image').value = data.cover_image || '';
        document.getElementById('post-video-url').value = data.video_url || '';
        document.getElementById('post-gallery-images').value = data.gallery_images ? data.gallery_images.join('\n') : '';
        document.getElementById('post-co-authors').value = data.co_authors ? data.co_authors.join(', ') : '';
        document.getElementById('post-scheduled').value = data.scheduled_publish_at ? formatDateTimeInput(data.scheduled_publish_at) : '';
        document.getElementById('post-editor-notes').value = data.editor_notes || '';

        togglePostTypeFields();
        
        document.getElementById('form-title').textContent = 'Editar Notícia';
        document.getElementById('submit-btn').textContent = 'Salvar Alterações';
        document.getElementById('cancel-edit-btn').style.display = 'inline-block';

        switchTab('create');
        window.scrollTo(0, 0);
    } catch (error) {
        console.error('Error:', error);
        alert('Erro ao carregar: ' + error.message);
    }
}

function cancelEdit() {
    editingPostId = null;
    document.getElementById('post-id').value = '';
    document.getElementById('create-post-form').reset();
    document.getElementById('form-title').textContent = 'Criar Nova Notícia';
    document.getElementById('submit-btn').textContent = 'Publicar Notícia';
    document.getElementById('cancel-edit-btn').style.display = 'none';
    togglePostTypeFields();
}

async function createOrUpdatePost(postData) {
    try {
        const postId = document.getElementById('post-id').value;
        
        if (postId) {
            const { error } = await supabaseClient
                .from('posts')
                .update(postData)
                .eq('id', postId);

            if (error) throw error;

            showAlert('create-alert', 'Atualizado!', 'success');
            cancelEdit();
        } else {
            const { error } = await supabaseClient
                .from('posts')
                .insert([postData]);

            if (error) throw error;

            showAlert('create-alert', 'Criado!', 'success');
            document.getElementById('create-post-form').reset();
            togglePostTypeFields();
        }

        setTimeout(() => {
            loadPendingPosts();
            loadApprovedPosts();
        }, 1000);
    } catch (error) {
        console.error('Error:', error);
        showAlert('create-alert', 'Erro: ' + error.message, 'error');
    }
}

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
        console.error('Error:', error);
    }
}

function renderUsers(users) {
    const container = document.getElementById('users-list');
    
    if (users.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">👥</div>
                <p class="empty-state-text">Nenhum usuário</p>
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
                                <button class="btn btn-secondary btn-small" onclick="changeUserPassword('${user.user_id}', '${user.email}')">
                                    🔑 Senha
                                </button>
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
    if (!isAdmin()) return;
    if (!confirm('Promover a Admin?')) return;

    try {
        const { error } = await supabaseClient
            .from('user_permissions')
            .update({ role: 'admin' })
            .eq('user_id', userId);

        if (error) throw error;
        alert('Promovido!');
        loadUsers();
    } catch (error) {
        alert('Erro: ' + error.message);
    }
}

async function demoteUser(userId) {
    if (!isAdmin()) return;
    if (!confirm('Rebaixar a Escritor?')) return;

    try {
        const { error } = await supabaseClient
            .from('user_permissions')
            .update({ role: 'writer' })
            .eq('user_id', userId);

        if (error) throw error;
        alert('Rebaixado!');
        loadUsers();
    } catch (error) {
        alert('Erro: ' + error.message);
    }
}

async function deleteUser(userId) {
    if (!isAdmin()) return;
    if (!confirm('Remover usuário?')) return;

    try {
        const { error } = await supabaseClient
            .from('user_permissions')
            .delete()
            .eq('user_id', userId);

        if (error) throw error;
        alert('Removido!');
        loadUsers();
    } catch (error) {
        alert('Erro: ' + error.message);
    }
}

async function changeUserPassword(userId, email) {
    const pwd = prompt(`Nova senha para ${email} (mín. 6):`);
    if (!pwd || pwd.length < 6) return alert('Mínimo 6 caracteres');
    alert('Use Supabase Dashboard:\nAuthentication → Users → usuário → Reset Password');
}

// ========================================
// UTILIDADES
// ========================================

function togglePostTypeFields() {
    const type = document.getElementById('post-type')?.value || 'text';
    const videoGroup = document.getElementById('video-url-group');
    const imageGroup = document.getElementById('cover-image-group');
    const galleryGroup = document.getElementById('gallery-images-group');
    const coverImg = document.getElementById('post-cover-image');
    const videoUrl = document.getElementById('post-video-url');
    
    if (type === 'video') {
        if (videoGroup) videoGroup.style.display = 'block';
        if (imageGroup) imageGroup.style.display = 'none';
        if (galleryGroup) galleryGroup.style.display = 'none';
        if (coverImg) coverImg.required = false;
        if (videoUrl) videoUrl.required = true;
    } else {
        if (videoGroup) videoGroup.style.display = 'none';
        if (imageGroup) imageGroup.style.display = 'block';
        if (galleryGroup) galleryGroup.style.display = 'block';
        if (coverImg) coverImg.required = true;
        if (videoUrl) videoUrl.required = false;
    }
}

function showAlert(containerId, message, type) {
    const container = document.getElementById(containerId);
    container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    setTimeout(() => { container.innerHTML = ''; }, 5000);
}

function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    const targetTab = document.querySelector(`[data-tab="${tabName}"]`);
    if (targetTab) targetTab.classList.add('active');

    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    const contentId = tabName === 'users' ? 'users-tab-content' : 
                      tabName === 'analytics' ? 'analytics-tab-content' : 
                      `${tabName}-tab`;
    const targetContent = document.getElementById(contentId);
    if (targetContent) targetContent.classList.add('active');

    if (tabName === 'pending') loadPendingPosts();
    else if (tabName === 'approved') loadApprovedPosts();
    else if (tabName === 'analytics') loadAnalytics();
    else if (tabName === 'users') loadUsers();
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('pt-BR');
}

function formatDateTime(dateString) {
    return new Date(dateString).toLocaleString('pt-BR');
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

// Funções globais
window.approvePost = approvePost;
window.deletePost = deletePost;
window.editPost = editPost;
window.cancelEdit = cancelEdit;
window.promoteUser = promoteUser;
window.demoteUser = demoteUser;
window.deleteUser = deleteUser;
window.changeUserPassword = changeUserPassword;
window.togglePostTypeFields = togglePostTypeFields;

// ========================================
// INICIALIZAÇÃO
// ========================================

async function init() {
    await checkAuth();

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await login(
            document.getElementById('login-email').value,
            document.getElementById('login-password').value
        );
    });

    document.getElementById('logout-btn').addEventListener('click', logout);

    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;
            if (tabName) switchTab(tabName);
        });
    });

    document.getElementById('create-post-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const categoriesSelect = document.getElementById('post-categories');
        const selectedCategories = Array.from(categoriesSelect.selectedOptions)
            .map(o => o.value)
            .slice(0, 3);

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
        const postType = document.getElementById('post-type').value;

        const postData = {
            categories: selectedCategories,
            category: selectedCategories[0],
            post_type: postType,
            video_url: postType === 'video' ? document.getElementById('post-video-url').value : null,
            cover_image: postType === 'video' 
                ? document.getElementById('post-video-url').value 
                : document.getElementById('post-cover-image').value,
            title: document.getElementById('post-title').value,
            short_description: document.getElementById('post-short-desc').value,
            full_text: document.getElementById('post-full-text').value,
            gallery_images: galleryImages.length > 0 ? galleryImages : null,
            co_authors: coAuthors.length > 0 ? coAuthors : null,
            scheduled_publish_at: scheduledPublish || null,
            editor_notes: document.getElementById('post-editor-notes').value || null,
            author: currentUserPermissions?.display_name || currentUser.email.split('@')[0],
            status: isAdmin() ? 'approved' : 'pending',
            created_at: new Date().toISOString()
        };

        if (isAdmin() && !scheduledPublish) {
            postData.published_at = new Date().toISOString();
        }

        await createOrUpdatePost(postData);
    });
}

// ========================================
// ANALYTICS FUNCTIONS
// ========================================

// Carregar Analytics
async function loadAnalytics() {
    if (!isAdmin()) {
        alert('Apenas administradores podem ver analytics');
        return;
    }

    try {
        const period = document.getElementById('analytics-period').value;
        const category = document.getElementById('analytics-category').value;
        const sortBy = document.getElementById('analytics-sort').value;

        let dateFilter = '';
        if (period !== 'all') {
            const daysAgo = parseInt(period);
            const date = new Date();
            date.setDate(date.getDate() - daysAgo);
            dateFilter = date.toISOString();
        }

        let query = supabaseClient
            .from('posts')
            .select('*')
            .eq('status', 'approved');

        if (dateFilter) {
            query = query.gte('published_at', dateFilter);
        }

        if (category !== 'all') {
            query = query.contains('categories', [category]);
        }

        switch (sortBy) {
            case 'views':
                query = query.order('view_count', { ascending: false });
                break;
            case 'likes':
                query = query.order('likes_count', { ascending: false });
                break;
            case 'shares':
                query = query.order('shares_count', { ascending: false });
                break;
            case 'reading_time':
                query = query.order('avg_reading_time', { ascending: false });
                break;
            case 'date':
                query = query.order('published_at', { ascending: false });
                break;
            default:
                query = query.order('view_count', { ascending: false });
        }

        const { data, error } = await query;

        if (error) throw error;

        renderAnalytics(data || []);
    } catch (error) {
        console.error('Erro ao carregar analytics:', error);
        alert('Erro ao carregar métricas: ' + error.message);
    }
}

// Renderizar Analytics
function renderAnalytics(posts) {
    const totals = posts.reduce((acc, post) => {
        acc.views += post.view_count || 0;
        acc.likes += post.likes_count || 0;
        acc.shares += post.shares_count || 0;
        acc.reactions += (post.reaction_like || 0) + (post.reaction_love || 0) + 
                        (post.reaction_interesting || 0) + (post.reaction_wow || 0) + 
                        (post.reaction_sad || 0) + (post.reaction_angry || 0);
        acc.totalReadingTime += (post.avg_reading_time || 0) * (post.reading_sessions || 1);
        acc.sessions += post.reading_sessions || 0;
        return acc;
    }, { views: 0, likes: 0, shares: 0, reactions: 0, totalReadingTime: 0, sessions: 0 });

    const avgReadingTime = totals.sessions > 0 ? Math.floor(totals.totalReadingTime / totals.sessions) : 0;
    const engagementRate = totals.views > 0 ? 
        ((totals.likes + totals.reactions + totals.shares) / totals.views * 100).toFixed(2) : 0;

    document.getElementById('total-views').textContent = formatNumber(totals.views);
    document.getElementById('total-likes').textContent = formatNumber(totals.likes);
    document.getElementById('total-reactions').textContent = formatNumber(totals.reactions);
    document.getElementById('total-shares').textContent = formatNumber(totals.shares);
    document.getElementById('avg-reading-time').textContent = formatTime(avgReadingTime);
    document.getElementById('engagement-rate').textContent = engagementRate + '%';

    const container = document.getElementById('analytics-table-container');
    
    if (posts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📊</div>
                <p class="empty-state-text">Nenhum post encontrado com os filtros selecionados</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <table class="analytics-table">
            <thead>
                <tr>
                    <th>Título</th>
                    <th>Categoria</th>
                    <th>👁️ Views</th>
                    <th>💚 Likes</th>
                    <th>🎭 Reações</th>
                    <th>🔗 Shares</th>
                    <th>⏱️ Tempo</th>
                    <th>📈 Engajamento</th>
                    <th>📅 Data</th>
                </tr>
            </thead>
            <tbody>
                ${posts.map(post => {
                    const totalReactions = (post.reaction_like || 0) + (post.reaction_love || 0) + 
                                          (post.reaction_interesting || 0) + (post.reaction_wow || 0) + 
                                          (post.reaction_sad || 0) + (post.reaction_angry || 0);
                    
                    const engagement = post.view_count > 0 ? 
                        (((post.likes_count || 0) + totalReactions + (post.shares_count || 0)) / post.view_count * 100).toFixed(1) : 0;
                    
                    const categories = post.categories || [post.category];
                    
                    return `
                        <tr>
                            <td class="post-title-cell" title="${post.title}">${post.title}</td>
                            <td>${categories[0]}</td>
                            <td class="metric-cell">${formatNumber(post.view_count || 0)}</td>
                            <td class="metric-cell">${formatNumber(post.likes_count || 0)}</td>
                            <td>
                                <div class="reactions-breakdown">
                                    ${post.reaction_like ? `<span class="reaction-item">👍 ${post.reaction_like}</span>` : ''}
                                    ${post.reaction_love ? `<span class="reaction-item">❤️ ${post.reaction_love}</span>` : ''}
                                    ${post.reaction_interesting ? `<span class="reaction-item">💡 ${post.reaction_interesting}</span>` : ''}
                                    ${post.reaction_wow ? `<span class="reaction-item">😮 ${post.reaction_wow}</span>` : ''}
                                    ${post.reaction_sad ? `<span class="reaction-item">😢 ${post.reaction_sad}</span>` : ''}
                                    ${post.reaction_angry ? `<span class="reaction-item">😠 ${post.reaction_angry}</span>` : ''}
                                    ${totalReactions === 0 ? '-' : ''}
                                </div>
                            </td>
                            <td class="metric-cell">${formatNumber(post.shares_count || 0)}</td>
                            <td>${formatTime(post.avg_reading_time || 0)}</td>
                            <td class="metric-cell">${engagement}%</td>
                            <td>${formatDate(post.published_at || post.created_at)}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

// Exportar CSV
function exportAnalyticsCSV() {
    alert('Exportação CSV em desenvolvimento!\n\nEm breve você poderá exportar todas as métricas.');
}

// Formatar número
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
}

// Formatar tempo
function formatTime(seconds) {
    if (!seconds || seconds === 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Expor funções
window.loadAnalytics = loadAnalytics;
window.exportAnalyticsCSV = exportAnalyticsCSV;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
