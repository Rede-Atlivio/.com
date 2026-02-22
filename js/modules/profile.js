// js/modules/profile.js
// 1. IMPORTAÇÃO DO CHAVEIRO MESTRE
import { db, auth, storage } from '../config.js'; 

import { doc, getDoc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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
        
        // Preenche Configurações
        if(document.getElementById('set-nome')) document.getElementById('set-nome').value = data.nome || user.displayName;
        if(document.getElementById('set-phone')) document.getElementById('set-phone').value = data.whatsapp || user.phoneNumber || "";
        
        // PIX
        if(document.getElementById('set-pix-chave')) document.getElementById('set-pix-chave').value = data.pix_key || "";
        if(document.getElementById('set-pix-banco')) document.getElementById('set-pix-banco').value = data.pix_bank || "";
        if(document.getElementById('set-pix-nome')) document.getElementById('set-pix-nome').value = data.pix_name || "";
        if(document.getElementById('set-pix-cpf')) document.getElementById('set-pix-cpf').value = data.pix_cpf || "";

        // Foto nas Configurações
        const imgSet = document.getElementById('settings-pic');
        if(imgSet) imgSet.src = data.foto_perfil || user.photoURL;

        // Capa
        const bannerPreview = document.getElementById('banner-preview');
        if(bannerPreview && data.cover_image) {
            bannerPreview.src = data.cover_image;
        }
    }
}

// ============================================================================
// 2. UPLOAD DE CAPA E FOTO
// ============================================================================
export async function uploadCapa() {
    const fileInput = document.getElementById('input-banner');
    if (!fileInput.files.length) return;
    const file = fileInput.files[0];
    const user = auth.currentUser;
    
    try {
        const storageRef = ref(storage, `capas/${user.uid}`);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);

        await setDoc(doc(db, "usuarios", user.uid), { cover_image: downloadURL }, { merge: true });
        await setDoc(doc(db, "active_providers", user.uid), { cover_image: downloadURL }, { merge: true });

        document.getElementById('banner-preview').src = downloadURL;
        alert("✅ Capa atualizada!");
    } catch (error) { alert("Erro ao enviar imagem."); }
}

export async function uploadFotoPerfil(input) {
    if (!input.files.length) return;
    const file = input.files[0];
    const user = auth.currentUser;

    try {
        const storageRef = ref(storage, `perfil/${user.uid}/foto.jpg`);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);

        await setDoc(doc(db, "usuarios", user.uid), { foto_perfil: downloadURL, photoURL: downloadURL }, { merge: true });
        await setDoc(doc(db, "active_providers", user.uid), { foto_perfil: downloadURL }, { merge: true });
        // Atualiza na hora
        document.querySelectorAll('img[src*="ui-avatars"], #header-profile-img, #settings-pic').forEach(img => img.src = downloadURL);
        alert("✅ Foto de perfil atualizada!");
    } catch (e) { alert("Erro no upload: " + e.message); }
}

// ============================================================================
// 3. CONFIGURAÇÕES & AFILIADO
// ============================================================================
export function abrirConfiguracoes() {
    console.log("⚙️ Abrindo configurações...");
    carregarDadosPerfil(); // Carrega dados frescos
    let modal = document.getElementById('modal-settings');
    if(modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    } else {
        alert("Erro: Modal de configurações não encontrado no HTML.");
    }
}

export async function salvarConfiguracoes() {
    const user = auth.currentUser;
    if(!user) return;

    const btn = document.getElementById('btn-save-settings');
    if(btn) { btn.innerText = "Salvando..."; btn.disabled = true; }

    try {
        // 1. Coleta os dados do formulário
        const nomeNovo = document.getElementById('set-nome')?.value || user.displayName;
        const payload = {
            nome: nomeNovo,
            pix_key: document.getElementById('set-pix-chave')?.value,
            pix_bank: document.getElementById('set-pix-banco')?.value,
            pix_name: document.getElementById('set-pix-nome')?.value,
            pix_cpf: document.getElementById('set-pix-cpf')?.value
        };

        // 2. Salva no Perfil Pessoal (Coleção usuarios)
        await setDoc(doc(db, "usuarios", user.uid), payload, { merge: true });

        // 3. 🛡️ ESPELHAMENTO DE SEGURANÇA (Atualiza a Vitrine Pública)
        // Verifica se o usuário já é um prestador ativo para atualizar lá também
        const providerRef = doc(db, "active_providers", user.uid);
        const providerSnap = await getDoc(providerRef);
        
        if (providerSnap.exists()) {
            // Se ele for prestador, atualiza o nome profissional lá também!
            await setDoc(providerRef, {
                nome_profissional: nomeNovo, // Força o nome novo na vitrine
                updated_at: new Date()       // Marca a atualização
            }, { merge: true });
            console.log("✅ Sincronia: Nome atualizado na Vitrine Pública.");
        }

        // 4. Atualiza visualmente na hora (sem F5)
        const headerName = document.getElementById('header-user-name');
        if(headerName) headerName.innerText = nomeNovo;

        alert("✅ Dados salvos e sincronizados com sucesso!");
        document.getElementById('modal-settings').classList.add('hidden');
        
        // Recarrega a vitrine se estiver nela
        if(window.carregarServicos) window.carregarServicos();

    } catch(e) { 
        console.error(e);
        alert("Erro ao salvar: " + e.message); 
    } finally { 
        if(btn) { btn.innerText = "SALVAR ALTERAÇÕES"; btn.disabled = false; } 
    }
}

export function copiarLinkAfiliado() {
    const user = auth.currentUser;
    if(!user) return alert("Faça login.");
    const link = `${window.location.origin}/?ref=${user.uid}`;
    navigator.clipboard.writeText(link).then(() => alert("✅ Link copiado!")).catch(() => prompt("Copie:", link));
}

// --- BÔNUS: FUNÇÃO DE VISUALIZAÇÃO DE PERFIL PÚBLICO (CORREÇÃO DE ERRO) ---
// Isso impede que o console dê erro vermelho ao clicar na foto do prestador
window.verPerfilCompleto = async (providerId) => {
    alert(`🚧 PERFIL DO PRESTADOR\n\nEsta funcionalidade completa será ativada na próxima atualização.\n\nPor enquanto, use o botão 'SOLICITAR' para ver detalhes e negociar.`);
};

// 🚨 EXPORTAÇÕES GLOBAIS OBRIGATÓRIAS
window.uploadCapa = uploadCapa;
window.uploadFotoPerfil = uploadFotoPerfil;
window.carregarDadosPerfil = carregarDadosPerfil;
window.abrirConfiguracoes = abrirConfiguracoes;
window.salvarConfiguracoes = salvarConfiguracoes;
window.copiarLinkAfiliado = copiarLinkAfiliado;
window.verPerfilCompleto = window.verPerfilCompleto; // Garante a exportação
