// Global Notification Manager
class NotificationManager {
    constructor() {
        this.ws = null;
        this.currentUserId = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        this.notificationCount = 0;
        this.soundEnabled = true;
        
        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }
    
    init() {
        console.log("🔔 Initializing Global Notification Manager");
        
        // Check authentication
        this.loadAuth();
        if (!localStorage.getItem("token")) {
            console.log("⚠️ User not authenticated, skipping notifications");
            return;
        }
        
        // Get current user and initialize WebSocket
        this.initializeNotifications();
        
        // Create notification badge in navbar
        this.createNotificationBadge();
        
        // Add sound notification capability
        this.setupSoundNotification();
    }
    
    async initializeNotifications() {
        try {
            const user = await this.fetchCurrentUser();
            if (user && user.id) {
                console.log("✅ User authenticated for notifications:", user.username);
                this.currentUserId = user.id;
                this.connectWebSocket();
            }
        } catch (error) {
            console.error("❌ Error getting current user for notifications:", error);
        }
    }
    
    connectWebSocket() {
        if (!this.currentUserId) return;
        
        try {
            const wsUrl = `${API_URL.replace("http://", "ws://")}/Notifications/ws/${this.currentUserId}`;
            console.log("🔌 Connecting to WebSocket:", wsUrl);
            
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log("✅ Global WebSocket connected successfully");
                this.isConnected = true;
                this.reconnectAttempts = 0;
            };
            
            this.ws.onmessage = (event) => {
                console.log("📨 Received global notification:", event.data);
                this.handleNotification(event.data);
            };
            
            this.ws.onerror = (error) => {
                console.error("❌ Global WebSocket error:", error);
                this.isConnected = false;
            };
            
            this.ws.onclose = (event) => {
                console.log("🔌 Global WebSocket disconnected:", event.code, event.reason);
                this.isConnected = false;
                
                // Only attempt to reconnect if it wasn't a manual close
                if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${this.reconnectDelay/1000} seconds...`);
                    setTimeout(() => {
                        if (this.currentUserId && localStorage.getItem("token")) {
                            this.connectWebSocket();
                        }
                    }, this.reconnectDelay);
                }
            };
        } catch (error) {
            console.error("❌ Failed to initialize global WebSocket:", error);
        }
    }
    
    handleNotification(message) {
        // Increment notification count
        this.notificationCount++;
        this.updateNotificationBadge();
        
        // Show toast notification
        this.showToast(message, "info");
        
        // Play sound notification
        if (this.soundEnabled) {
            this.playNotificationSound();
        }
        
        // Refresh friends page if it's open
        if (window.location.pathname.includes('friends.html')) {
            if (typeof loadFriends === 'function') {
                loadFriends();
            }
        }
    }
    
    createNotificationBadge() {
        // Find the Friends navbar item
        const friendsNavItem = document.querySelector('a[href="friends.html"]');
        if (friendsNavItem) {
            // Remove existing badge if any
            const existingBadge = friendsNavItem.querySelector('.notification-badge');
            if (existingBadge) {
                existingBadge.remove();
            }
            
            // Create notification badge
            const badge = document.createElement('span');
            badge.className = 'notification-badge position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger';
            badge.style.cssText = `
                font-size: 0.6rem;
                padding: 0.25em 0.4em;
                min-width: 1.2em;
                display: none;
            `;
            badge.textContent = '0';
            
            // Make the nav item position relative
            friendsNavItem.style.position = 'relative';
            friendsNavItem.appendChild(badge);
            
            console.log("✅ Notification badge created");
        }
    }
    
    updateNotificationBadge() {
        const badge = document.querySelector('.notification-badge');
        if (badge) {
            if (this.notificationCount > 0) {
                badge.textContent = this.notificationCount;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }
    }
    
    clearNotifications() {
        this.notificationCount = 0;
        this.updateNotificationBadge();
    }
    
    setupSoundNotification() {
        // Create audio context for notification sound
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.warn("⚠️ Audio context not supported:", error);
            this.soundEnabled = false;
        }
    }
    
    playNotificationSound() {
        if (!this.soundEnabled || !this.audioContext) return;
        
        try {
            // Create a simple notification sound
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
            oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime + 0.1);
            
            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.2);
            
            console.log("🔊 Played notification sound");
        } catch (error) {
            console.warn("⚠️ Failed to play notification sound:", error);
        }
    }
    
    showToast(message, type = "primary") {
        // Create toast container if it doesn't exist
        let container = document.getElementById("globalToastContainer");
        if (!container) {
            container = document.createElement("div");
            container.id = "globalToastContainer";
            container.className = "toast-container position-fixed top-0 end-0 p-3";
            container.style.zIndex = "9999";
            document.body.appendChild(container);
        }
        
        const toastEl = document.createElement("div");
        toastEl.className = `toast align-items-center text-bg-${type} border-0`;
        toastEl.setAttribute("role", "alert");
        toastEl.setAttribute("aria-live", "assertive");
        toastEl.setAttribute("aria-atomic", "true");
        
        const icon = type === "success" ? "check-circle" : 
                     type === "danger" ? "exclamation-triangle" : 
                     type === "info" ? "info-circle" : "bell";
        
        toastEl.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <i class="bi bi-${icon} me-2"></i>${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        
        container.appendChild(toastEl);
        
        const toast = new bootstrap.Toast(toastEl, { delay: 5000 });
        toast.show();
        
        toastEl.addEventListener('hidden.bs.toast', () => {
            toastEl.remove();
        });
    }
    
    // Utility functions (reused from config.js)
    loadAuth() {
        const token = localStorage.getItem("token");
        const user = localStorage.getItem("user");
        
        if (token) {
            this.setToken(token);
        }
        
        if (user) {
            try {
                this.setCurrentUser(JSON.parse(user));
            } catch (e) {
                console.error("Error parsing current user:", e);
            }
        }
    }
    
    setToken(token) {
        localStorage.setItem("token", token);
    }
    
    setCurrentUser(user) {
        window.currentUser = user;
        localStorage.setItem("user", JSON.stringify(user));
    }
    
    getHeaders() {
        const token = localStorage.getItem("token");
        return {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        };
    }
    
    async fetchCurrentUser() {
        try {
            const res = await fetch(`${API_URL}/users/user/me`, {
                headers: this.getHeaders()
            });
            
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            
            const user = await res.json();
            this.setCurrentUser(user);
            localStorage.setItem("user", JSON.stringify(user));
            return user;
        } catch (err) {
            console.error("❌ Error fetching current user:", err);
            throw err;
        }
    }
    
    // Cleanup when page is unloaded
    cleanup() {
        if (this.ws) {
            this.ws.close(1000, "Page unloading");
            this.ws = null;
        }
    }
}

// Initialize global notification manager
const globalNotifications = new NotificationManager();

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
    globalNotifications.cleanup();
});

// Export for use in other scripts
window.globalNotifications = globalNotifications;




