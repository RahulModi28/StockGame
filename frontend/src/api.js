import axios from 'axios';

// Replace localhost with local IP for LAN access
// Replace localhost with local IP for LAN access
// In production, set VITE_API_URL env var
const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;

const api = axios.create({
    baseURL: API_URL,
    timeout: 30000, // 30 seconds timeout
});

// Add request interceptor to include auth token
api.interceptors.request.use(
    (config) => {
        const user = localStorage.getItem('user');
        if (user) {
            const userData = JSON.parse(user);
            if (userData.token) {
                config.headers.Authorization = `Bearer ${userData.token}`;
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add response interceptor to handle 401s
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            // Dispatch event for AuthContext to handle
            window.dispatchEvent(new CustomEvent('auth-error', { detail: error }));
        }
        return Promise.reject(error);
    }
);

export const loginTeam = (idToken) => api.post('/auth/login', { id_token: idToken });
// Market API
export const getMarketStatus = () => api.get(`/market/status?_t=${Date.now()}`);
export const getCompanies = () => api.get(`/market/companies?_t=${Date.now()}`);
export const getPriceHistory = (companyId) => api.get(`/market/history/${companyId}`);
export const getCandles = (companyId, interval = 60) => api.get(`/market/candles/${companyId}?interval=${interval}&_t=${Date.now()}`);
export const placeTrade = (userId, tradeData) => api.post(`/market/trade?team_id=${userId}`, tradeData);
export const getPortfolio = (teamId) => api.get(`/portfolio/${teamId}?_t=${Date.now()}`);
export const getLeaderboard = () => api.get('/portfolio/leaderboard/global');
export const getNews = () => api.get('/news/');
export const buyInsiderTip = (teamId) => api.post(`/news/insider/buy?team_id=${teamId}`);

// Team Management APIs
export const createInvite = (teamId, maxUses = 1, expiresInDays = 7) =>
    api.post(`/teams/invite?team_id=${teamId}`, { max_uses: maxUses, expires_in_days: expiresInDays });
export const joinTeam = (inviteCode) => api.post(`/teams/join/${inviteCode}`);
export const getMyTeams = () => api.get('/teams/my-teams');
export const getTeamMembers = (teamId) => api.get(`/teams/${teamId}/members`);
export const removeMember = (teamId, memberEmail) => api.delete(`/teams/${teamId}/members/${memberEmail}`);

// Limit Order APIs
export const createLimitOrder = (teamId, orderData) => api.post(`/orders/create?team_id=${teamId}`, orderData);
export const getLimitOrders = (teamId) => api.get(`/orders/list?team_id=${teamId}&_t=${Date.now()}`);
export const updateLimitOrder = (teamId, orderId, updates) => api.put(`/orders/${orderId}?team_id=${teamId}`, updates);
export const cancelLimitOrder = (teamId, orderId) => api.delete(`/orders/${orderId}?team_id=${teamId}`);

// Admin APIs
export const startSession = () => api.post('/admin/session/start');
export const endSession = (delayMinutes) => api.post(`/admin/session/end?delay_minutes=${delayMinutes}`);
export const setMarketStatus = (isOpen) => api.post('/admin/market/status', { is_open: isOpen });
export const setChaosMode = (enabled) => api.post('/admin/market/chaos', { enabled });
export const setSectorTrend = (sector, trend) => api.post('/admin/market/sector', { sector, trend });
export const getSectorTrends = () => api.get('/admin/market/sector');
export const getMarketCycle = () => api.get('/market/cycle');
export const setVolatility = (volatility) => api.post('/admin/market/volatility', { volatility });
export const setStockPrice = (companyId, price) => api.post('/admin/stock/price', { company_id: companyId, price });
export const createNews = (newsData) => api.post('/admin/news/create', newsData);
export const getAllUsers = () => api.get('/admin/users');
export const getUserPortfolio = (userId) => api.get(`/admin/users/${userId}/portfolio`);
export const adjustmentBalance = (userId, amount, type) => api.post(`/admin/users/${userId}/balance`, { amount, type });
export const makeUserAdmin = (userId) => api.post(`/admin/users/${userId}/make-admin`);
export const removeUserAdmin = (userId) => api.post(`/admin/users/${userId}/remove-admin`);
export const banUser = (userId, isBanned) => api.post(`/admin/users/${userId}/ban`, { is_banned: isBanned });
export const getWhaleAlerts = (threshold = 20000) => api.get(`/admin/analytics/whales?threshold=${threshold}`);

// Backward-compatible aliases used by existing pages
export const adjustBalance = adjustmentBalance;
export const makeAdmin = makeUserAdmin;
export const removeAdmin = removeUserAdmin;

// Event APIs
export const triggerCrash = () => api.post('/admin/event/crash');
export const triggerDividend = (companyId, amount) => api.post(`/admin/event/dividend/${companyId}?amount=${amount}`);

export default api;
