import { db, auth } from '../app.js';
import { userProfile } from '../auth.js';
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// LÓGICA DO BOTÃO ONLINE/OFFLINE
export async function toggleOnlineStatus(isOnline) {
    if(!auth.currentUser) return;
    
    const statusMsg = document.getElementById('status-msg');
    const container = document.getElementById('lista-chamados');

    if(isOnline) {
        // Visual: Ficou Online
        if(statusMsg) statusMsg.innerHTML = `<p class="text-4xl mb-2 animate-bounce">📡</p><p class="text-xs font-bold uppercase text-green-600">Você está Online</p><p class="text-[9px]">Aguardando chamados na sua região...</p>`;
        if(container) container.classList.remove('hidden');
        
        // Banco: Avisa que tá on
        // await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { status: "online" });
    } else {
        // Visual: Ficou Offline
        if(statusMsg) statusMsg.innerHTML = `<p class="text-4xl mb-2">😴</p><p class="text-xs font-bold uppercase text-gray-400">Você está Offline</p><p class="text-[9px]">Ative o botão no topo para trabalhar.</p>`;
        if(container) container.classList.add('hidden');
        
        // Banco: Avisa que tá off
        // await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { status: "offline" });
    }
}

// Escuta o clique no botão (checkbox) do header
const toggleBtn = document.getElementById('online-toggle');
if(toggleBtn) {
    toggleBtn.addEventListener('change', (e) => {
        toggleOnlineStatus(e.target.checked);
    });
}
