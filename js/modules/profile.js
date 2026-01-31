import { db, auth, storage } from '../app.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// ============================================================================
// 1. CARREGAMENTO E VISUALIZAÇÃO
// ============================================================================
export async function carregarDadosPerfil() {
    const user = auth.currentUser;
    if (!user) return;

    // Header (Foto pequena no menu)
    const imgHeader = document.getElementById('header-profile-img');
    if(imgHeader) {
        imgHeader.src = user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}&background=0D8ABC&color=fff`;
    }

    const docRef = doc(db, "usuarios", user.uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Inputs do Formulário
        if(document.getElementById('input-nome')) document.getElementById('input-nome').value = data.nome || user.displayName;
        if(document.getElementById('input-bio')) document.getElementById('input-bio').value = data.bio || "";
        if(document.getElementById('input-pix')) document.getElementById('input-pix').value = data.pix || "";
        
        // Link de Afiliado (Visual)
        const refDisplay = document.getElementById('ref-link-display');
        if(refDisplay) refDisplay.innerText = `${window.location.origin}/?ref=${user.uid}`;

        // Capa (Preview)
        const bannerPreview = document.getElementById('banner-preview');
        if(bannerPreview && data.cover_image) {
            bannerPreview.src = data.cover_image;
        }
    }
}

// ============================================================================
// 2. UPLOAD DE CAPA (MARKETING)
// ============================================================================
export async function uploadCapa() {
    const fileInput = document.getElementById('input-banner');
    if (!fileInput.files.length) return;

    const file = fileInput.files[0];
    const user = auth.currentUser;
    const btn = document.getElementById('btn-upload-banner');
    
    btn.innerText = "⏳"; btn.disabled = true;

    try {
        const storageRef = ref(storage, `capas/${user.uid}`);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);

        // Atualiza no Perfil de Usuário
        await updateDoc(doc(db, "usuarios", user.uid), { cover_image: downloadURL });
        
        // Tenta atualizar na Vitrine de Prestadores (se existir)
        try {
            await updateDoc(doc(db, "active_providers", user.uid), { cover_image: downloadURL });
        } catch(e) { /* Não é prestador, ignora */ }

        document.getElementById('banner-preview').src = downloadURL;
        alert("✅ Capa atualizada! Seu perfil ficou mais profissional.");

    } catch (error) { 
        console.error(error); 
        alert("Erro ao enviar imagem."); 
    } finally { 
        btn.innerText = "📷"; btn.disabled = false; 
    }
}

// ============================================================================
// 3. CONFIGURAÇÕES & AFILIADO
// ============================================================================
export function abrirConfiguracoes() {
    let modal = document.getElementById('modal-configuracoes');
    if(modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    } else {
        // Fallback: vai para a aba perfil
        const tab = document.getElementById('tab-perfil');
        if(tab) tab.click();
    }
}

export async function salvarConfiguracoes() {
    const user = auth.currentUser;
    if(!user) return;

    const btn = document.getElementById('btn-save-profile');
    if(btn) { btn.innerText = "Salvando..."; btn.disabled = true; }

    try {
        const nome = document.getElementById('input-nome')?.value;
        const bio = document.getElementById('input-bio')?.value;
        const pix = document.getElementById('input-pix')?.value;

        await updateDoc(doc(db, "usuarios", user.uid), {
            nome: nome,
            bio: bio,
            pix: pix
        });
        alert("✅ Perfil salvo com sucesso!");
    } catch(e) { 
        alert("Erro ao salvar: " + e.message); 
    } finally { 
        if(btn) { btn.innerText = "Salvar Alterações"; btn.disabled = false; } 
    }
}

// 🔥 FUNÇÃO RESTAURADA (O Auditor sentiu falta)
export function copiarLinkAfiliado() {
    const user = auth.currentUser;
    if(!user) return alert("Faça login.");
    
    const link = `${window.location.origin}/?ref=${user.uid}`;
    
    navigator.clipboard.writeText(link).then(() => {
        alert("✅ Link copiado! Espalhe e ganhe.");
    }).catch(err => {
        prompt("Copie seu link:", link);
    });
}

// EXPORTAÇÕES GLOBAIS
window.uploadCapa = uploadCapa;
window.carregarDadosPerfil = carregarDadosPerfil;
window.abrirConfiguracoes = abrirConfiguracoes;
window.salvarConfiguracoes = salvarConfiguracoes;
window.copiarLinkAfiliado = copiarLinkAfiliado;
