import { doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. ABRIR MODAL E CARREGAR DADOS
export async function abrirConfiguracoes() {
    const user = window.auth.currentUser;
    if (!user) return alert("Você precisa estar logado.");

    const modal = document.getElementById('modal-settings');
    const img = document.getElementById('settings-pic');
    const nome = document.getElementById('set-nome');
    const phone = document.getElementById('set-phone');
    const pix = document.getElementById('set-pix');
    const uidLabel = document.getElementById('set-uid');

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Preenchimento inicial visual (cache ou auth)
    uidLabel.innerText = user.uid.substring(0, 6) + "...";
    img.src = user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || 'User'}&background=random`;
    nome.value = user.displayName || "";
    phone.value = user.phoneNumber || "";

    // Busca dados completos no Firestore (Pix, etc)
    try {
        const docSnap = await getDoc(doc(window.db, "usuarios", user.uid));
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.nome) nome.value = data.nome;
            if (data.whatsapp) phone.value = data.whatsapp; // Prioridade banco
            if (data.chave_pix) pix.value = data.chave_pix;
            if (data.foto_perfil) img.src = data.foto_perfil;
        }
    } catch (e) {
        console.error("Erro ao carregar perfil:", e);
    }
}

// 2. SALVAR DADOS
export async function salvarConfiguracoes() {
    const user = window.auth.currentUser;
    if (!user) return;

    const btn = document.getElementById('btn-save-settings');
    const nome = document.getElementById('set-nome').value.trim();
    const pix = document.getElementById('set-pix').value.trim();
    
    if (nome.length < 3) return alert("Nome muito curto.");

    const originalText = btn.innerText;
    btn.innerText = "SALVANDO...";
    btn.disabled = true;

    try {
        const updates = {
            nome: nome,
            nome_profissional: nome, // Mantém sincronizado
            chave_pix: pix,
            updated_at: serverTimestamp()
        };

        await updateDoc(doc(window.db, "usuarios", user.uid), updates);
        
        // Atualiza interface principal sem reload
        const headerName = document.getElementById('header-user-name');
        if(headerName) headerName.innerText = nome;
        
        alert("✅ Dados atualizados com sucesso!");
        document.getElementById('modal-settings').classList.add('hidden');

    } catch (e) {
        alert("Erro ao salvar: " + e.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// 3. EXTRAS (Afiliado)
export function copiarLinkAfiliado() {
    const user = window.auth.currentUser;
    if (!user) return;
    
    const link = `${window.location.origin}${window.location.pathname}?ref=${user.uid}`;
    
    navigator.clipboard.writeText(link).then(() => {
        alert("🔗 Link copiado! Envie para seus amigos.\n\n" + link);
    }).catch(() => {
        prompt("Copie seu link:", link);
    });
}

// Torna global para o HTML acessar
window.salvarConfiguracoes = salvarConfiguracoes;
window.copiarLinkAfiliado = copiarLinkAfiliado;
