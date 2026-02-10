// Supabase Configuration
const SUPABASE_URL = 'https://1bvtpawkufemgikeepqb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IjFidnRwYXdrdWZlbWdpa2VlcHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg2MTAxMTAsImV4cCI6MjA1NDE4NjExMH0.ZyIGtnTXOsEilCJYrXQ1QjE3Nz42NQg2MTkzImV4cCI6MTcwMjgxNjIxfQ.eyJpc3M3NDE3ZzdXBhYmFzZSI6MTcwMjgxNjIxfQ';

// Verificar se já existe uma instância
if (typeof window.voofSupabase === 'undefined') {
    window.voofSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const supabaseClient = window.voofSupabase;
let currentUser = null;

// Check authentication
async function checkAuth() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        if (user) {
            currentUser = user;
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

// Show/Hide screens
function showLoginScreen() {
    document.getElementById('login-screen').style.display = 'block';
    document.getElementById('admin-panel').style.display = 'none';
}

function showAdminPanel() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
    
    if (currentUser) {
        document.getElementById('user-name').textContent = currentUser.email.split('@')[0];
    }
}

// Login
async function login(email, password) {
    try {
        console.log('Tentando fazer login...', email);

        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        console.log('Resposta do login:', { data, error });

        if (error) throw error;

        if (!data.user) {
            throw new Error('Login retornou vazio. Verifique se o usuário existe no Supabase.');
        }

        currentUser = data.user;
        console.log('Login bem sucedido!', currentUser);
        showAdminPanel();
        loadPendingPosts();
        showAlert('login-alert', 'Login realizado com sucesso!', 'success');
    } catch (error) {
        console.error('Login error completo:', error);
        
        let errorMessage = 'Erro desconhecido';
        
        if (error.message.includes('Invalid login credentials')) {
            errorMessage = 'Email ou senha incorretos';
        } else if (error.message.includes('Email not confirmed')) {
            errorMessage = 'Email não confirmado. Verifique se marcou "Auto Confirm User" no Supabase';
        } else if (error.message.includes('fetch')) {
            errorMessage = 'Erro de conexão. Verifique se as credenciais do Supabase estão corretas';
        } else {
            errorMessage = error.message;
        }
        
        showAlert('login-alert', 'Erro ao fazer login: ' + errorMessage, 'error');
    }
}

// Logout
async function logout() {
    try {
        await supabaseClient.auth.signOut();
        currentUser = null;
        showLoginScreen();
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Load pending posts
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

// Load approved posts
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

// Render posts
function renderPosts(containerId, posts, status) {
    const container = document.getElementById(containerId);
    
    if (posts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">${status === 'pending' ? '📝' : '📰'}</div>
                <p class="empty-state-text">
                    ${status === 'pending' ? 'Nenhum post pendente de aprovação' : 'Nenhum post publicado ainda'}
                </p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="posts-grid">
            ${posts.map(post => `
                <div class="post-card">
                    <img src="${post.cover_image || 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400'}" 
                         alt="${post.title}" 
                         class="post-image">
                    <div class="post-content">
                        <span class="post-category">${post.category}</span>
                        <h3 class="post-title">${post.title}</h3>
                        <p class="post-description">${post.short_description}</p>
                        <div class="post-meta">
                            <span>${post.author || 'Anônimo'}</span>
                            <span class="post-status ${status === 'pending' ? 'status-pending' : 'status-approved'}">
                                ${status === 'pending' ? 'Pendente' : 'Publicado'}
                            </span>
                        </div>
                        <div class="post-actions">
                            ${status === 'pending' ? `
                                <button class="btn btn-primary btn-small" onclick="approvePost('${post.id}')">
                                    Aprovar
                                </button>
                            ` : ''}
                            <button class="btn btn-danger btn-small" onclick="deletePost('${post.id}')">
                                Excluir
                            </button>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Approve post
async function approvePost(postId) {
    if (!confirm('Deseja aprovar este post?')) return;

    try {
        const { error } = await supabaseClient
            .from('posts')
            .update({ status: 'approved' })
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

// Delete post
async function deletePost(postId) {
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

// Create post
async function createPost(postData) {
    try {
        const { data, error } = await supabaseClient
            .from('posts')
            .insert([{
                title: postData.title,
                short_description: postData.short_description,
                full_text: postData.full_text,
                category: postData.category,
                cover_image: postData.cover_image,
                gallery_images: postData.gallery_images,
                author: currentUser?.email?.split('@')[0] || 'Admin',
                status: 'approved',
                created_at: new Date().toISOString()
            }])
            .select();

        if (error) throw error;

        showAlert('create-alert', 'Notícia criada e publicada com sucesso!', 'success');
        document.getElementById('create-post-form').reset();
        
        setTimeout(() => {
            switchTab('approved');
            loadApprovedPosts();
        }, 1500);
    } catch (error) {
        console.error('Error creating post:', error);
        showAlert('create-alert', 'Erro ao criar post: ' + error.message, 'error');
    }
}

// Show alert
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

// Switch tabs
function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');

    if (tabName === 'pending') {
        loadPendingPosts();
    } else if (tabName === 'approved') {
        loadApprovedPosts();
    }
}

// Make functions available globally
window.approvePost = approvePost;
window.deletePost = deletePost;

// Initialize
async function init() {
    await checkAuth();

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
            switchTab(tabName);
        });
    });

    document.getElementById('create-post-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const galleryImagesText = document.getElementById('post-gallery-images').value;
        const galleryImages = galleryImagesText
            .split('\n')
            .map(url => url.trim())
            .filter(url => url.length > 0);

        const postData = {
            category: document.getElementById('post-category').value,
            title: document.getElementById('post-title').value,
            short_description: document.getElementById('post-short-desc').value,
            full_text: document.getElementById('post-full-text').value,
            cover_image: document.getElementById('post-cover-image').value,
            gallery_images: galleryImages.length > 0 ? galleryImages : null
        };

        await createPost(postData);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
