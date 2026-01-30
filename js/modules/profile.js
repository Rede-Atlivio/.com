import { doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. ABRIR MODAL E CARREGAR DADOS
export async function abrirConfiguracoes() {
    const user = window.auth.currentUser;
    if (!user) return alert("Você precisa estar logado.");

    const modal = document.getElementById('modal-settings');
    
    // Elementos Básicos
    const img = document.getElementById('settings-pic');
    const nome = document.getElementById('set-nome');
    const phone = document.getElementById('set-phone');
    const uidLabel = document.getElementById('set-uid');

    // Elementos do PIX (Novos IDs)
    const pixChave = document.getElementById('set-pix-chave');
    const pixBanco = document.getElementById('set-pix-banco');
    const pixCpf = document.getElementById('set-pix-cpf');
    const pixNome = document.getElementById('set-pix-nome');

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Preenchimento inicial visual (cache ou auth)
    if(uidLabel) uidLabel.innerText = user.uid.substring(0, 6) + "...";
    if(img) img.src = user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || 'User'}&background=random`;
    if(nome) nome.value = user.displayName || "";
    if(phone) phone.value = user.phoneNumber || "";

    // Busca dados completos no Firestore
    try {
        const docSnap = await getDoc(doc(window.db, "usuarios", user.uid));
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Dados Pessoais
            if (data.nome && nome) nome.value = data.nome;
            if (data.whatsapp && phone) phone.value = data.whatsapp;
            if (data.foto_perfil && img) img.src = data.foto_perfil;

            // Dados Financeiros (PIX)
            // Tenta pegar os campos novos, se não existirem, deixa vazio
            if (pixChave) pixChave.value = data.pix_chave || ""; 
            if (pixBanco) pixBanco.value = data.pix_banco || "";
            if (pixCpf) pixCpf.value = data.pix_cpf || "";
            if (pixNome) pixNome.value = data.pix_nome || "";
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
    
    // Captura os dados do PIX
    const pixChave = document.getElementById('set-pix-chave')?.value.trim() || "";
    const pixBanco = document.getElementById('set-pix-banco')?.value.trim() || "";
    const pixCpf = document.getElementById('set-pix-cpf')?.value.trim() || "";
    const pixNome = document.getElementById('set-pix-nome')?.value.trim() || "";

    if (nome.length < 3) return alert("Nome muito curto.");

    const originalText = btn.innerText;
    btn.innerText = "SALVANDO...";
    btn.disabled = true;

    try {
        const updates = {
            nome: nome,
            nome_profissional: nome,
            // Salva os 4 campos no banco
            pix_chave: pixChave,
            pix_banco: pixBanco,
            pix_cpf: pixCpf,
            pix_nome: pixNome,
            updated_at: serverTimestamp()
        };

        await updateDoc(doc(window.db, "usuarios", user.uid), updates);
        
        // Atualiza interface principal sem reload
        const headerName = document.getElementById('header-user-name');
        if(headerName) headerName.innerText = nome;
        
        alert("✅ Dados bancários atualizados com sucesso!");
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
