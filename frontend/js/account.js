// Enhanced Account Page JavaScript
console.log("✅ Account.js loaded successfully");

// Initialize authentication
loadAuth();

// Global variables
let currentUserData = null;

// Utility functions
function showToast(message, type = 'success') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type} border-0`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    
    // Add to container
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
        toastContainer.style.zIndex = '9999';
        document.body.appendChild(toastContainer);
    }
    
    toastContainer.appendChild(toast);
    
    // Show toast
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
    
    // Remove after hide
    toast.addEventListener('hidden.bs.toast', () => {
        toast.remove();
    });
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
}

function getActivityIcon(action) {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('expense')) return 'bi-receipt';
    if (actionLower.includes('group')) return 'bi-people';
    if (actionLower.includes('friend')) return 'bi-person-plus';
    if (actionLower.includes('settlement')) return 'bi-check-circle';
    if (actionLower.includes('wallet')) return 'bi-wallet2';
    if (actionLower.includes('income')) return 'bi-cash-stack';
    return 'bi-activity';
}

function getActivityColor(action) {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('expense')) return 'text-warning';
    if (actionLower.includes('group')) return 'text-primary';
    if (actionLower.includes('friend')) return 'text-success';
    if (actionLower.includes('settlement')) return 'text-info';
    if (actionLower.includes('wallet')) return 'text-secondary';
    if (actionLower.includes('income')) return 'text-success';
    return 'text-muted';
}

// Load account data
async function loadAccount() {
    console.log("🔄 Loading account data...");
    
    const token = localStorage.getItem("token");
    if (!token) {
        console.log("❌ No token found, redirecting to login");
        return window.location.href = "login.html";
    }

    try {
        // Load user data
        const userRes = await fetch(`${API_URL}/users/user/me`, {
            headers: getHeaders()
        });
        
        if (!userRes.ok) {
            throw new Error(`Failed to load user: ${userRes.status}`);
        }

        const user = await userRes.json();
        currentUserData = user;
        window.currentUserId = user.id;
        localStorage.setItem("currentUser", JSON.stringify(user));

        console.log("✅ User data loaded:", user);

        // Update profile display
        updateProfileDisplay(user);
        
        // Load recent activity preview
        await loadActivityPreview();

    } catch (err) {
        console.error("❌ Error loading account:", err);
        showToast("Failed to load account data", 'danger');
    }
}

// Update profile display
function updateProfileDisplay(user) {
    const fullName = user.first_name && user.last_name 
        ? `${user.first_name} ${user.last_name}` 
        : user.username || 'Unknown User';
    
    document.getElementById("profileName").textContent = fullName;
    document.getElementById("profileEmail").textContent = user.email || "No email";
    document.getElementById("profilePhone").textContent = user.phone || "No phone";
    
    const profilePhoto = user.profile_photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random&color=fff`;
    document.getElementById("profilePhoto").src = profilePhoto;
    
    // Update modal form fields
    updateModalForm(user);
}

// Update modal form with current user data
function updateModalForm(user) {
        document.getElementById("modal_username").value = user.username || "";
        document.getElementById("modal_first_name").value = user.first_name || "";
        document.getElementById("modal_last_name").value = user.last_name || "";
        document.getElementById("modal_gender").value = user.gender || "";
        document.getElementById("modal_email").value = user.email || "";
        document.getElementById("modal_phone").value = user.phone || "";
        document.getElementById("modal_profile_photo").value = user.profile_photo || "";
    
    const previewPhoto = user.profile_photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || 'User')}&background=random&color=fff`;
    document.getElementById("modalPhotoPreview").src = previewPhoto;
}


// Load activity preview (last 3 activities)
async function loadActivityPreview() {
    console.log("🔄 Loading activity preview...");
    
    try {
        const response = await fetch(`${API_URL}/activity`, {
            headers: getHeaders()
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch activities: ${response.status}`);
        }

        const logs = await response.json();
        const previewContainer = document.getElementById("activityPreview");

        if (!Array.isArray(logs) || logs.length === 0) {
            previewContainer.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="bi bi-clock-history fs-1 mb-3"></i>
                    <p class="mb-0">No recent activity</p>
                </div>
            `;
            return;
        }

        // Show only last 3 activities
        const recentLogs = logs.slice(0, 3);
        
        previewContainer.innerHTML = recentLogs.map(log => {
            const date = new Date(log.created_at);
            const formattedDate = isNaN(date.getTime()) ? "Unknown date" : formatDate(log.created_at);
            const icon = getActivityIcon(log.action);
            const color = getActivityColor(log.action);
            
            return `
                <div class="activity-item d-flex align-items-center">
                    <div class="me-3">
                        <i class="bi ${icon} ${color} fs-5"></i>
                    </div>
                    <div class="flex-grow-1">
                        <div class="fw-semibold">${log.username}</div>
                        <div class="text-muted small">${log.action}</div> 
                    </div>
                    <div class="text-muted small">${formattedDate}</div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("❌ Error loading activity preview:", err);
        const previewContainer = document.getElementById("activityPreview");
        previewContainer.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="bi bi-exclamation-triangle fs-1 mb-3"></i>
                <p class="mb-0">Failed to load activity</p>
            </div>
        `;
    }
}

// Load full activity for modal
async function loadFullActivity() {
    console.log("🔄 Loading full activity...");
    
    const modalContent = document.getElementById("activityModalContent");
    
    try {
        const response = await fetch(`${API_URL}/activity`, {
            headers: getHeaders()
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch activities: ${response.status}`);
        }

        const logs = await response.json();

        if (!Array.isArray(logs) || logs.length === 0) {
            modalContent.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="bi bi-clock-history fs-1 mb-3"></i>
                    <h5>No Activity Yet</h5>
                    <p class="mb-0">Your activity will appear here as you use SplitEasy</p>
                </div>
            `;
            return;
        }

        modalContent.innerHTML = `
            <div class="activity-timeline">
                ${logs.map(log => {
                    const date = new Date(log.created_at);
                    const formattedDate = isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString();
                    const icon = getActivityIcon(log.action);
                    const color = getActivityColor(log.action);
                    
                    return `
                        <div class="activity-timeline-item">
                            <div class="d-flex align-items-start">
                                <div class="me-3">
                                    <i class="bi ${icon} ${color} fs-5"></i>
                                </div>
                                <div class="flex-grow-1">
                                    <div class="fw-semibold mb-1">${log.username}</div>
                                    <div class="text-muted mb-1">${log.action}</div>
                                    <div class="text-muted small">${formattedDate}</div>
                                    ${log.target_type ? `<span class="badge bg-light text-dark mt-1">${log.target_type}</span>` : ''}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

    } catch (err) {
        console.error("❌ Error loading full activity:", err);
        modalContent.innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="bi bi-exclamation-triangle fs-1 mb-3"></i>
                <h5>Error Loading Activity</h5>
                <p class="mb-0">Failed to load activity data</p>
            </div>
        `;
    }
}

// Event listeners
document.addEventListener("DOMContentLoaded", () => {
    console.log("🚀 Account page initialized");
    loadAccount();
});

// Live photo preview for URL
document.getElementById("modal_profile_photo").addEventListener("input", (e) => {
    const preview = document.getElementById("modalPhotoPreview");
    preview.src = e.target.value || `https://ui-avatars.com/api/?name=${encodeURIComponent('User')}&background=random&color=fff`;
});

// Update account form submission
document.getElementById("modalAccountForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log("💾 Updating account...");
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    try {
        // Show loading state
        submitBtn.innerHTML = '<div class="loading-spinner me-2"></div>Saving...';
        submitBtn.disabled = true;
        
    const payload = {
            username: document.getElementById("modal_username").value.trim(),
            first_name: document.getElementById("modal_first_name").value.trim() || null,
            last_name: document.getElementById("modal_last_name").value.trim() || null,
            email: document.getElementById("modal_email").value.trim(),
            phone: document.getElementById("modal_phone").value.trim() || null,
        gender: document.getElementById("modal_gender").value || null,
            profile_photo: document.getElementById("modal_profile_photo").value.trim() || null
        };

        // Validate required fields
        if (!payload.username || !payload.email) {
            throw new Error("Username and email are required");
        }

        const res = await fetch(`${API_URL}/users/${window.currentUserId}`, {
            method: "PUT",
            headers: getHeaders(),
            body: JSON.stringify(payload)
        });
        
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to update account: ${res.status}`);
        }
        
        const updated = await res.json();
        console.log("✅ Account updated successfully:", updated);
        
        // Update local storage and display
        localStorage.setItem("currentUser", JSON.stringify(updated));
        currentUserData = updated;
        updateProfileDisplay(updated);
        
        // Show success message
        showToast("Profile updated successfully!", 'success');
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById("editProfileModal"));
        modal.hide();
        
    } catch (err) {
        console.error("❌ Error updating account:", err);
        showToast(err.message || "Error updating account", 'danger');
    } finally {
        // Reset button state
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
});

// Delete account
document.getElementById("modalDeleteBtn").addEventListener("click", async () => {
    if (!confirm("⚠️ Are you sure you want to delete your account?\n\nThis action cannot be undone and will permanently remove all your data.")) {
        return;
    }
    
    const confirmText = prompt("Type 'DELETE' to confirm account deletion:");
    if (confirmText !== 'DELETE') {
        showToast("Account deletion cancelled", 'info');
        return;
    }
    
    console.log("🗑️ Deleting account...");
    
    try {
        const res = await fetch(`${API_URL}/users/${window.currentUserId}`, {
            method: "DELETE",
            headers: getHeaders()
        });
        
        if (!res.ok) {
            throw new Error(`Failed to delete account: ${res.status}`);
        }
        
        console.log("✅ Account deleted successfully");
        showToast("Account deleted successfully", 'success');
        
        // Clear local storage and redirect
        localStorage.clear();
        setTimeout(() => {
        window.location.href = "login.html";
        }, 2000);
        
    } catch (err) {
        console.error("❌ Error deleting account:", err);
        showToast(err.message || "Error deleting account", 'danger');
    }
});

// Logout functionality
document.getElementById("logoutBtnAccount").addEventListener("click", () => {
    if (confirm("Are you sure you want to logout?")) {
        console.log("🚪 Logging out...");
    localStorage.removeItem("token");
    localStorage.removeItem("currentUser");
        showToast("Logged out successfully", 'info');
        setTimeout(() => {
    window.location.href = "index.html";
        }, 1000);
    }
});

// Activity modal event listener
document.getElementById("activityModal").addEventListener("show.bs.modal", () => {
    console.log("📱 Opening activity modal");
    loadFullActivity();
});

// Auto-load when page ready
document.addEventListener("DOMContentLoaded", () => {
    console.log("🎯 Account page DOM loaded");
});