import { auth, db, provider } from './app.js';
import { signInWithPopup, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const storage = getStorage();
const ADMIN_EMAILS = ["contatogilborges@gmail.com"];
const DEFAULT_TENANT = "atlivio_fsa_01";
export let userProfile = null;

// --- LOGIN / LOGOUT ---
window.loginGoogle = () => signInWithPopup(auth, provider).catch(e => alert("Erro login: " + e.message));
window.logout = () => signOut(auth).then(() => location.reload());

// --- GESTÃO DE PERFIL ---
window.definirPerfil = async (tipo) => {
    if(!auth.currentUser) return;
    try {
        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { 
            is_provider: tipo === 'prestador', 
            perfil_completo: true 
        });
        location.reload();
    } catch(e) { alert("Erro ao salvar perfil: " + e.message); }
};

window.alternarPerfil = async () => {
    if(!userProfile) return;
    const btn = document.getElementById('btn-trocar-perfil');
    if(btn) { btn.innerText = "🔄 ..."; btn.disabled = true; }
    try {
        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { 
            is_provider: !userProfile.is_provider 
        });
        setTimeout(() => location.reload(), 500);
    } catch (e) { alert("Erro: " + e.message); if(btn) btn.disabled = false; }
};

// --- FUNÇÃO QUE FALTAVA: SALVAR NOME E SERVIÇOS DO PRESTADOR ---
window.saveServicesAndGoOnline = async () => {
    const nomeInput = document.getElementById('setup-name').value;
    const modal = document.getElementById('provider-setup-modal');

    if(!nomeInput) return alert("Digite seu nome profissional.");
    // Verifica se a variável meusServicos (do services.js) está acessível ou se precisamos recarregar
    // Para simplificar, assumimos que services.js já atualizou a variável global se ela fosse exportada
    // Mas como services.js não exporta, confiamos que o modal foi manipulado corretamente.
    
    // NOTA: Para garantir integridade, idealmente services.js exportaria 'meusServicos'.
    // Como estamos separando arquivos, vamos salvar o que estiver no banco ou o que foi editado no services.js
    // A melhor abordagem rápida aqui é apenas salvar o nome e fechar, deixando o services.js lidar com a lista.

    try {
        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), {
            nome_profissional: nomeInput,
            setup_profissional_ok: true
        });
        
        // Atualiza o userProfile local
        userProfile.nome_profissional = nomeInput;
        
        // Chama a função de ficar online (do services.js)
        if(window.alternarStatusOnline) {
            await window.alternarStatusOnline(true);
        }
        
        alert("✅ Perfil configurado! Você está Online.");
        modal.classList.add('hidden');
        
        // Atualiza a tela
        document.getElementById('online-toggle').checked = true;
        
    } catch(e) {
        console.error(e);
        alert("Erro ao salvar: " + e.message);
    }
};

// --- UPLOAD FOTO ---
window.uploadFotoPerfil = async (input) => {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const user = auth.currentUser;
    if (!user) return;

    const overlay = document.getElementById('upload-overlay');
    if(overlay) overlay.classList.remove('hidden');

    try {
        const storageRef = ref(storage, `perfil/${user.uid}/foto_perfil.jpg`);
        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);

        await updateProfile(user, { photoURL: downloadURL });
        await updateDoc(doc(db, "usuarios", user.uid), { photoURL: downloadURL });

        // Atualiza no radar se for prestador
        const activeRef = doc(db, "active_providers", user.uid);
        getDoc(activeRef).then(snap => {
            if(snap.exists()) updateDoc(activeRef, { foto_perfil: downloadURL });
        });

        document.querySelectorAll('img[id$="-pic"], #header-user-pic, #provider-header-pic').forEach(img => img.src = downloadURL);
        alert("✅ Foto atualizada!");
    } catch (error) {
        console.error(error);
        alert("Erro no upload. Tente outra imagem.");
    } finally {
        if(overlay) overlay.classList.add('hidden');
        input.value = "";
    }
};

// --- NÚCLEO DE AUTENTICAÇÃO ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('auth-container').classList.add('hidden');
        const userRef = doc(db, "usuarios", user.uid);
        
        onSnapshot(userRef, async (docSnap) => {
            try {
                if(!docSnap.exists()) {
                    const roleInicial = ADMIN_EMAILS.includes(user.email) ? 'admin' : 'user';
                    userProfile = { 
                        email: user.email, 
                        displayName: user.displayName, 
                        photoURL: user.photoURL,        
                        tenant_id: DEFAULT_TENANT, 
                        perfil_completo: false, 
                        role: roleInicial, 
                        saldo: 0, 
                        is_provider: false,
                        created_at: new Date()
                    };
                    await setDoc(userRef, userProfile);
                } else {
                    userProfile = docSnap.data();
                    if ((user.photoURL && user.photoURL !== userProfile.photoURL && !userProfile.photoURL.includes('firebasestorage'))) {
                        updateDoc(userRef, { displayName: user.displayName, photoURL: user.photoURL }).catch(()=>{});
                    }
                    iniciarAppLogado(user);
                    
                    if (userProfile.is_provider && !userProfile.setup_profissional_ok) {
                        const modal = document.getElementById('provider-setup-modal');
                        if(modal) {
                            modal.classList.remove('hidden');
                            const inputNome = document.getElementById('setup-name');
                            if(inputNome && !inputNome.value) inputNome.value = user.displayName || "";
                        }
                    }
                }
            } catch (err) {
                console.error("Erro crítico perfil:", err);
                iniciarAppLogado(user); 
            }
        });
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('role-selection').classList.add('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});

function iniciarAppLogado(user) {
    if(!userProfile || !userProfile.perfil_completo) {
        document.getElementById('app-container').classList.add('hidden');
        document.getElementById('role-selection').classList.remove('hidden');
        return;
    }

    document.getElementById('role-selection').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    
    const btnPerfil = document.getElementById('btn-trocar-perfil');
    const isAdmin = ADMIN_EMAILS.some(email => email.toLowerCase() === user.email.toLowerCase().trim());
    const tabServicos = document.getElementById('tab-servicos');
    const adminTab = document.getElementById('tab-admin');
    const adminSec = document.getElementById('sec-admin');

    if(isAdmin) {
        if(adminTab) adminTab.classList.remove('hidden');
    } else {
        if(adminTab) adminTab.classList.add('hidden');
        if(adminSec) adminSec.classList.add('hidden');
    }

    if (userProfile.is_provider) {
        // PRESTADOR
        if(btnPerfil) btnPerfil.innerHTML = isAdmin 
            ? `🛡️ <span class="text-red-600 font-black">ADMIN</span> 🔄`
            : `Sou: <span class="text-blue-600">PRESTADOR</span> 🔄`;
        
        if(tabServicos) tabServicos.innerText = "Serviços 🛠️";
        
        toggleDisplay('tab-servicos', true);
        toggleDisplay('tab-missoes', true);
        toggleDisplay('tab-oportunidades', true);
        toggleDisplay('tab-ganhar', true);
        toggleDisplay('tab-loja', false);
        
        toggleDisplay('status-toggle-container', true);
        toggleDisplay('servicos-prestador', true);
        toggleDisplay('servicos-cliente', false);
        
        if (!document.querySelector('nav button.border-blue-600') && window.switchTab) window.switchTab('servicos'); 

    } else {
        // CLIENTE
        if(btnPerfil) btnPerfil.innerHTML = isAdmin 
            ? `🛡️ <span class="text-red-600 font-black">ADMIN</span> 🔄`
            : `Sou: <span class="text-green-600">CLIENTE</span> 🔄`;
            
        if(tabServicos) tabServicos.innerText = "Contratar Serviço 🛠️";
        
        toggleDisplay('tab-servicos', true);
        toggleDisplay('tab-oportunidades', true);
        toggleDisplay('tab-loja', true);
        toggleDisplay('tab-missoes', false);
        toggleDisplay('tab-ganhar', false);
        
        toggleDisplay('status-toggle-container', false);
        toggleDisplay('servicos-prestador', false);
        toggleDisplay('servicos-cliente', true);
        
        if (!document.querySelector('nav button.border-blue-600') && window.switchTab) window.switchTab('servicos');
    }
}

function toggleDisplay(id, show) {
    const el = document.getElementById(id);
    if(el) {
        if(show) el.classList.remove('hidden');
        else el.classList.add('hidden');
    }
}
