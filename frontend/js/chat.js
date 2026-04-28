// frontend/js/chat.js
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const groupId = urlParams.get('id');

    if (!groupId) return;

    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const chatMessagesContainer = document.getElementById('chatMessagesContainer');
    let currentUserId = null;
    let hasLoadedHistory = false;

    // Load current user for message alignment
    async function initChat() {
        const userStr = localStorage.getItem("user");
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                currentUserId = user.id;
            } catch (e) {
                console.error("Error parsing user:", e);
            }
        }

        // Listen to offcanvas open to load history if not already loaded, 
        // or just load immediately
        const chatOffcanvas = document.getElementById('chatOffcanvas');
        if (chatOffcanvas) {
            chatOffcanvas.addEventListener('show.bs.offcanvas', () => {
                if (!hasLoadedHistory) {
                    loadChatHistory();
                } else {
                    // Just scroll to bottom to be safe
                    setTimeout(scrollToBottom, 100);
                }
            });
        }
    }

    async function loadChatHistory() {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_URL}/groups/${groupId}/messages`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            if (res.ok) {
                const messages = await res.json();
                renderMessages(messages);
                hasLoadedHistory = true;
            }
        } catch (error) {
            console.error("Error loading chat history:", error);
        }
    }

    function renderMessages(messages) {
        if (!chatMessagesContainer) return;

        if (messages.length === 0) {
            chatMessagesContainer.innerHTML = `
                <div class="text-center text-muted small mt-4">
                  <i class="bi bi-lock-fill me-1"></i> Messages are end-to-end awesome.
                </div>
            `;
            return;
        }

        chatMessagesContainer.innerHTML = messages.map(msg => createMessageHTML(msg)).join('');
        setTimeout(scrollToBottom, 50);
    }

    function createMessageHTML(msg) {
        const isMe = msg.user_id === currentUserId;
        const timeStr = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (isMe) {
            return `
                <div class="d-flex justify-content-end mb-3">
                    <div style="max-width: 75%;">
                        <div class="bg-primary text-white rounded p-2 px-3 shadow-sm text-break">
                            ${escapeHTML(msg.content)}
                        </div>
                        <div class="text-end text-muted small mt-1" style="font-size: 0.7rem;">
                            ${timeStr}
                        </div>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="d-flex justify-content-start mb-3">
                    <div style="max-width: 75%;">
                        <div class="small fw-bold text-muted mb-1 ms-1" style="font-size: 0.75rem;">
                            ${msg.username || 'Unknown'}
                        </div>
                        <div class="bg-white border rounded p-2 px-3 shadow-sm text-break">
                            ${escapeHTML(msg.content)}
                        </div>
                        <div class="text-start text-muted small mt-1" style="font-size: 0.7rem;">
                            ${timeStr}
                        </div>
                    </div>
                </div>
            `;
        }
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g,
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }

    function scrollToBottom() {
        if (chatMessagesContainer) {
            chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
        }
    }

    if (chatForm) {
        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const content = chatInput.value.trim();
            if (!content) return;

            // Optimistically clear input
            chatInput.value = '';

            // Optimistically append message to UI instantly
            const tempMsg = {
                id: 'temp-' + Date.now(),
                content: content,
                user_id: currentUserId,
                username: window.currentUser ? window.currentUser.username : 'Me',
                group_id: parseInt(groupId),
                created_at: new Date().toISOString()
            };

            const tempId = `msg-${tempMsg.id}`;
            const msgHtml = createMessageHTML(tempMsg);

            if (chatMessagesContainer.innerHTML.includes("Messages are end-to-end awesome.") && chatMessagesContainer.children.length === 1) {
                chatMessagesContainer.innerHTML = '';
            }
            chatMessagesContainer.insertAdjacentHTML('beforeend', `<div id="${tempId}" style="opacity: 0.7;">${msgHtml}</div>`);
            setTimeout(scrollToBottom, 50);

            try {
                const token = localStorage.getItem("token");
                const res = await fetch(`${API_URL}/groups/${groupId}/messages`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({ content, group_id: parseInt(groupId) })
                });

                if (res.ok) {
                    const msg = await res.json();

                    // Replace temp message with real one
                    const tempEl = document.getElementById(tempId);
                    if (tempEl) {
                        tempEl.outerHTML = createMessageHTML(msg);
                        setTimeout(scrollToBottom, 50);
                    } else {
                        appendMessage(msg);
                    }
                } else {
                    console.error("Failed to send message");
                    chatInput.value = content;
                    const tempEl = document.getElementById(tempId);
                    if (tempEl) tempEl.remove();
                }
            } catch (error) {
                console.error("Error sending message:", error);
                chatInput.value = content;
                const tempEl = document.getElementById(tempId);
                if (tempEl) tempEl.remove();
            }
        });
    }

    function appendMessage(msg) {
        if (!chatMessagesContainer) return;

        // Remove empty state if present
        if (chatMessagesContainer.innerHTML.includes("Messages are end-to-end awesome.") && chatMessagesContainer.children.length === 1) {
            chatMessagesContainer.innerHTML = '';
        }

        chatMessagesContainer.insertAdjacentHTML('beforeend', createMessageHTML(msg));
        setTimeout(scrollToBottom, 50);
    }

    // Listen for real-time messages broadcasted via the global notifications websocket
    window.addEventListener('newChatMessage', (e) => {
        const msg = e.detail;
        // Only append if it's for the current group
        if (msg.group_id == groupId) {
            appendMessage(msg);

            // If the offcanvas is open, we consider it read, otherwise the user sees a toast
            const offcanvasEl = document.getElementById('chatOffcanvas');
            if (offcanvasEl && offcanvasEl.classList.contains('show')) {
                // Chat is open, message shown
            } else {
                // A toast has already been triggered by notifications.js
                // We could add an unread badge to the chat open button here
                const chatBtn = document.querySelector('button[data-bs-target="#chatOffcanvas"]');
                if (chatBtn) {
                    chatBtn.classList.remove('btn-warning');
                    chatBtn.classList.add('btn-danger', 'animate__animated', 'animate__pulse');
                    setTimeout(() => {
                        chatBtn.classList.remove('animate__animated', 'animate__pulse');
                    }, 1000);
                }
            }
        }
    });

    // Reset button color when opening chat
    const chatOffcanvas = document.getElementById('chatOffcanvas');
    if (chatOffcanvas) {
        chatOffcanvas.addEventListener('show.bs.offcanvas', () => {
            const chatBtn = document.querySelector('button[data-bs-target="#chatOffcanvas"]');
            if (chatBtn) {
                chatBtn.classList.remove('btn-danger');
                chatBtn.classList.add('btn-warning');
            }
        });
    }

    initChat();
});
