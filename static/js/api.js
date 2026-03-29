// api.js

// 공통 요청 함수
async function request(url, options = {}) {
    const res = await fetch(url, options);
    const data = await res.json();
    return { ok: res.ok, status: res.status, data }; // 결과와 데이터를 함께 반환
}

export const API = {
    me: () => request('/api/me'),
    
    login: (username, password) => request('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    }),
    
    register: (username, password) => request('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    }),
    
    logout: () => request('/api/logout', { method: 'POST' }),
    
    createConversation: (payload) => request('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }),
    
    getConversations: () => request('/api/conversations'),
    
    updateConversation: (id, title) => request(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
    }),
    
    deleteConversation: (id) => request(`/api/conversations/${id}`, { method: 'DELETE' }),
    
    getMessages: (id) => request(`/api/conversations/${id}/messages`),
    
    sendMessage: (id, content) => request(`/api/conversations/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
    }),
    
    getReport: (id) => request(`/api/conversations/${id}/report`),
    
    addFavorite: (payload) => request('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }),
    
    getFavorites: (query = '') => request(`/api/favorites${query}`),
    
    deleteFavorite: (id) => request(`/api/favorites/${id}`, { method: 'DELETE' }),
    
    addVocabulary: (payload) => request('/api/vocabulary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }),
    
    getVocabulary: (query = '') => request(`/api/vocabulary${query}`),
    
    deleteVocabulary: (id) => request(`/api/vocabulary/${id}`, { method: 'DELETE' })
};