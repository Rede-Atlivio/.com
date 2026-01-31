import { db, auth } from '../app.js';
import { collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp, where, doc, getDoc, updateDoc, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ============================================================================
// 1. ROTEADOR E INTERFACE
// ============================================================================
export function carregarInterfaceEmpregos() {
    console.log("💼 Iniciando módulo de Vagas (Versão Seleção)...");
    const containerVagas = document.getElementById('lista-vagas');
    const containerEmpresa = document.getElementById('painel-empresa');
    const userProfile = window.userProfile; 

    // Reset visual
    if(containerVagas) containerVagas.classList.add('hidden');
    if(containerEmpresa) containerEmpresa.classList.add('hidden');

    // Injeta o Modal de Candidatos no HTML se não existir
    if(!document.getElementById('modal-candidatos-empresa')) {
        criarModalCandidatos();
    }

    if (!auth.currentUser) {
        if(containerVagas) {
            containerVagas.innerHTML = `<div class="text-center py-10"><p class="text-gray-400 text-xs">Faça login para ver vagas.</p></div>`;
            containerVagas.classList.remove('hidden');
        }
        return;
    }

    if (userProfile && userProfile.is_provider) {
        // --- VISÃO DO PRESTADOR ---
        if(containerVagas) {
            containerVagas.classList.remove('hidden');
            containerVagas.innerHTML = `
                <div class="flex gap-4 mb-4 border-b border-gray-100 pb-2">
                    <button onclick="window.carregarVagas()" class="text-blue-600 font-bold text-xs uppercase border-b-2 border-blue-600 pb-1 flex-1">Vagas Abertas</button>
                    <button onclick="window.listarMinhasCandidaturas()" class="text-gray-400 font-bold text-xs uppercase hover:text-blue-600 transition pb-1 flex-1">Minhas Candidaturas</button>
                </div>
                <div id="vagas-content"></div>
            `;
            carregarVagas();
        }
    } else {
        // --- VISÃO DA EMPRESA ---
        if(containerEmpresa) {
             containerEmpresa.classList.remove('hidden');
             listarMinhasVagasEmpresa();
        }
    }
}

// ============================================================================
// 2. PRESTADOR (CANDIDATO)
// ============================================================================
export async function carregarVagas() {
    const container = document.getElementById('vagas-content');
    if(!container) return;
    
    container.innerHTML = `<div class="text-center py-10"><div class="loader mx-auto mb-2"></div></div>`;

    try {
        const q = query(collection(db, "jobs"), where("status", "==", "ativa"), orderBy("created_at", "desc"), limit(20));
        const snap = await getDocs(q);
        
        container.innerHTML = "";
        if (snap.empty) { container.innerHTML = `<div class="text-center py-10 opacity-50"><p class="text-xs">Nenhuma vaga aberta.</p></div>`; return; }

        snap.forEach(d => {
            const job = d.data();
            const titulo = job.title || job.titulo || "Vaga";
            
            // NOTA: Removemos o botão de chat daqui. O candidato só se candidata.
            container.innerHTML += `
                <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-3 relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
                    <div class="flex justify-between items-start mb-2 pl-2">
                        <div>
                            <h3 class="font-black text-sm text-gray-800 uppercase">${titulo}</h3>
                            <p class="text-[10px] text-gray-500 font-bold">${job.company || 'Empresa'}</p>
                        </div>
                        <span class="text-[9px] bg-green-50 text-green-600 px-2 py-1 rounded font-bold uppercase">R$ ${job.salary || 'Combinar'}</span>
                    </div>
                    <p class="text-xs text-gray-600 mb-3 pl-2 line-clamp-2">${job.description}</p>
                    <button onclick="window.candidatarVaga('${d.id}', '${titulo}', '${job.owner_id}')" class="w-full bg-slate-900 text-white py-2 rounded-lg text-xs font-bold uppercase hover:bg-blue-600 transition shadow-lg">
                        ENVIAR CURRÍCULO
                    </button>
                </div>
            `;
        });
    } catch (e) { container.innerHTML = `<p class="text-red-500 text-xs">Erro ao carregar.</p>`; }
}

export async function listarMinhasCandidaturas() {
    const container = document.getElementById('vagas-content');
    container.innerHTML = `<div class="text-center py-10"><div class="loader mx-auto"></div></div>`;

    try {
        const q = query(collection(db, "job_applications"), where("user_id", "==", auth.currentUser.uid), orderBy("created_at", "desc"));
        const snap = await getDocs(q);

        container.innerHTML = "";
        if (snap.empty) { container.innerHTML = `<p class="text-center text-xs text-gray-400 py-6">Você não se candidatou a nada.</p>`; return; }

        snap.forEach(d => {
            const app = d.data();
            
            // LÓGICA DO "A EMPRESA QUER FALAR COM VOCÊ"
            let areaChat = "";
            let statusColor = "text-gray-400";
            let statusText = "Aguardando";

            // Se o status for 'chat_aberto' ou 'interview', mostra o botão
            if (app.status === 'chat_aberto' || app.status === 'interview') {
                statusColor = "text-green-500";
                statusText = "EMPRESA CHAMOU";
                areaChat = `
                    <div class="mt-2 bg-green-50 border border-green-100 p-2 rounded flex items-center justify-between animate-pulse">
                        <span class="text-[10px] font-bold text-green-700">👋 A empresa quer falar com você!</span>
                        <button onclick="window.irParaChat('${app.owner_id}', 'Empresa')" class="bg-green-600 text-white px-3 py-1 rounded text-[10px] font-bold shadow">ABRIR CHAT</button>
                    </div>
                `;
            }

            container.innerHTML += `
                <div class="bg-white p-4 rounded-xl border border-gray-200 mb-2 shadow-sm">
                    <div class="flex justify-between items-center mb-1">
                        <p class="font-bold text-xs text-blue-900">${app.vaga_titulo}</p>
                        <span class="text-[9px] font-bold uppercase ${statusColor}">${statusText}</span>
                    </div>
                    <p class="text-[9px] text-gray-400 mb-2">Enviado em: ${app.created_at?.toDate().toLocaleDateString()}</p>
                    
                    ${areaChat}

                    <button onclick="window.desistirVaga('${d.id}')" class="mt-2 w-full text-[9px] text-red-400 border border-red-100 py-1 rounded hover:bg-red-50">Cancelar Candidatura</button>
                </div>
            `;
        });
    } catch (e) { console.error(e); }
}

// ============================================================================
// 3. EMPRESA (PAINEL DE SELEÇÃO)
// ============================================================================
export async function listarMinhasVagasEmpresa() {
    const container = document.getElementById('lista-minhas-vagas');
    if(!container || !auth.currentUser) return;

    const q = query(collection(db, "jobs"), where("owner_id", "==", auth.currentUser.uid), orderBy("created_at", "desc"));
    const snap = await getDocs(q);
    
    container.innerHTML = "";
    if (snap.empty) { container.innerHTML = `<p class="text-center text-xs text-gray-400 py-2">Crie sua primeira vaga.</p>`; return; }
    
    snap.forEach(d => {
        const v = d.data();
        const titulo = v.title || v.titulo || "Sem Título";
        const isAtiva = v.status === 'ativa';
        // Conta quantos candidatos (simulado ou real se tiver o campo)
        const candidatosBtn = `<button onclick="window.verCandidatosEmpresa('${d.id}', '${titulo}')" class="flex-1 bg-blue-600 text-white text-[10px] font-bold py-2 rounded-lg shadow hover:bg-blue-500 flex items-center justify-center gap-2">📄 VER CANDIDATOS</button>`;
        
        container.innerHTML += `
            <div class="bg-white p-4 rounded-xl border border-gray-100 mb-3 shadow-sm">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <p class="font-black text-sm text-blue-900 uppercase">${titulo}</p>
                        <p class="text-[10px] text-gray-400">Criado em: ${v.created_at?.toDate().toLocaleDateString()}</p>
                    </div>
                    <span class="text-[9px] ${isAtiva ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} font-bold px-2 py-1 rounded uppercase">${v.status || 'ativa'}</span>
                </div>
                
                <div class="flex gap-2">
                    ${candidatosBtn}
                    ${isAtiva ? `<button onclick="window.encerrarVaga('${d.id}')" class="px-3 bg-red-50 text-red-500 font-bold border border-red-100 rounded-lg text-[10px]">⛔</button>` : ''}
                </div>
            </div>
        `;
    });
}

// --- MODAL DE CANDIDATOS (AQUI A MÁGICA ACONTECE) ---
export async function verCandidatosEmpresa(jobId, jobTitle) {
    const modal = document.getElementById('modal-candidatos-empresa');
    const lista = document.getElementById('lista-candidatos-ul');
    const titulo = document.getElementById('modal-job-title');
    
    titulo.innerText = jobTitle;
    lista.innerHTML = `<div class="text-center py-6"><div class="loader mx-auto"></div></div>`;
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    try {
        const q = query(collection(db, "job_applications"), where("job_id", "==", jobId));
        const snap = await getDocs(q);

        lista.innerHTML = "";
        if(snap.empty) { lista.innerHTML = `<p class="text-center text-gray-400 text-xs py-4">Ninguém se candidatou ainda.</p>`; return; }

        snap.forEach(d => {
            const cand = d.data();
            // Link do currículo
            const linkCv = cand.resume_url || cand.cv_url || cand.file_url;
            const btnCv = linkCv ? `<a href="${linkCv}" target="_blank" class="text-blue-500 underline text-[10px]">Baixar CV</a>` : `<span class="text-gray-400 text-[10px]">Sem CV</span>`;
            
            // Botão de Chat
            const jaChamou = cand.status === 'chat_aberto';
            const btnChat = jaChamou 
                ? `<button disabled class="bg-gray-200 text-gray-500 px-3 py-1 rounded text-[10px] font-bold w-full cursor-not-allowed">JÁ CHAMADO</button>`
                : `<button onclick="window.iniciarConversaEmpresa('${d.id}', '${cand.user_id}', '${cand.nome}')" class="bg-green-600 text-white px-3 py-1 rounded text-[10px] font-bold w-full shadow hover:bg-green-500">💬 CHAMAR P/ ENTREVISTA</button>`;

            lista.innerHTML += `
                <div class="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-2">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="font-bold text-xs text-slate-800">${cand.nome || 'Candidato'}</p>
                            <p class="text-[10px] text-slate-500 italic">"${cand.mensagem || ''}"</p>
                        </div>
                        ${btnCv}
                    </div>
                    <div class="mt-3">
                        ${btnChat}
                    </div>
                </div>
            `;
        });

    } catch(e) { console.error(e); lista.innerHTML = "Erro ao carregar."; }
}

// AÇÃO DA EMPRESA: INICIAR CONVERSA
export async function iniciarConversaEmpresa(appId, userId, userName) {
    if(!confirm(`Iniciar conversa com ${userName}?`)) return;

    try {
        // 1. Atualiza o status da candidatura para o candidato ver o aviso
        await updateDoc(doc(db, "job_applications", appId), { status: 'chat_aberto' });

        // 2. Cria/Abre o Chat
        const chatID = [auth.currentUser.uid, userId].sort().join("_");
        const chatRef = doc(db, "chats", chatID);
        
        await setDoc(chatRef, {
            users: [auth.currentUser.uid, userId],
            user_names: [auth.currentUser.displayName, userName],
            last_msg: "Olá! Vimos seu currículo e gostaríamos de conversar.",
            last_time: serverTimestamp(),
            job_context: appId // Liga o chat à candidatura
        }, { merge: true });

        alert(`✅ Chat iniciado com ${userName}!`);
        
        // Fecha modal e recarrega
        document.getElementById('modal-candidatos-empresa').classList.remove('flex');
        document.getElementById('modal-candidatos-empresa').classList.add('hidden');
        
        // Redireciona para o chat (Opcional)
        // document.querySelector('[data-target="chat"]').click(); 

    } catch(e) { alert("Erro ao abrir chat: " + e.message); }
}

// ============================================================================
// 4. UTILITÁRIOS (CRIAR HTML DINAMICAMENTE)
// ============================================================================
function criarModalCandidatos() {
    const div = document.createElement('div');
    div.id = "modal-candidatos-empresa";
    div.className = "fixed inset-0 z-50 bg-black/80 backdrop-blur-sm hidden items-center justify-center p-4";
    div.innerHTML = `
        <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div class="bg-slate-900 p-4 flex justify-between items-center">
                <h3 class="text-white font-bold text-sm uppercase flex items-center gap-2">
                    📄 Candidatos: <span id="modal-job-title" class="text-blue-400">...</span>
                </h3>
                <button onclick="document.getElementById('modal-candidatos-empresa').classList.add('hidden'); document.getElementById('modal-candidatos-empresa').classList.remove('flex')" class="text-gray-400 hover:text-white">✕</button>
            </div>
            <div id="lista-candidatos-ul" class="p-4 overflow-y-auto custom-scrollbar flex-1 bg-white">
                </div>
        </div>
    `;
    document.body.appendChild(div);
}

export function irParaChat(targetUid, name) {
    // Redireciona para a aba de chat do seu app
    const tabChat = document.querySelector('[data-target="chat"]');
    if(tabChat) {
        tabChat.click();
        // Lógica extra para abrir a conversa específica pode ser adicionada no chat.js
    } else {
        alert("Vá para a aba de Mensagens.");
    }
}

export function candidatarVaga(id, title, ownerId) {
    if(!auth.currentUser) return alert("Faça login.");
    const modal = document.getElementById('modal-apply');
    document.getElementById('apply-job-title').innerText = title;
    
    // Hack para limpar listeners antigos
    const btnOld = document.getElementById('btn-submit-proposal');
    const btnNew = btnOld.cloneNode(true);
    btnOld.parentNode.replaceChild(btnNew, btnOld);

    modal.classList.remove('hidden');
    modal.classList.add('flex'); 

    btnNew.addEventListener('click', async () => {
        const msg = document.getElementById('apply-message').value;
        const fakeCV = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
        
        btnNew.innerText = "ENVIANDO..."; btnNew.disabled = true;
        try {
            await addDoc(collection(db, "job_applications"), {
                job_id: id, vaga_titulo: title, owner_id: ownerId,
                user_id: auth.currentUser.uid, nome: auth.currentUser.displayName || "Candidato",
                message: msg, resume_url: fakeCV, created_at: serverTimestamp(), status: 'novo'
            });
            alert("✅ Currículo Enviado!");
            fecharModalCandidatura();
        } catch(e) { alert(e.message); } finally { btnNew.innerText = "ENVIAR"; btnNew.disabled = false; }
    });
}

export function fecharModalCandidatura() {
    const modal = document.getElementById('modal-apply');
    modal.classList.add('hidden'); modal.classList.remove('flex');
}

export async function encerrarVaga(id) {
    if(!confirm("Encerrar vaga?")) return;
    await updateDoc(doc(db, "jobs", id), { status: 'encerrada' });
    listarMinhasVagasEmpresa();
}

// EXPORTAÇÕES GLOBAIS
window.carregarInterfaceEmpregos = carregarInterfaceEmpregos;
window.carregarVagas = carregarVagas;
window.publicarVaga = publicarVaga;
window.listarMinhasVagasEmpresa = listarMinhasVagasEmpresa;
window.candidatarVaga = candidatarVaga;
window.verCandidatosEmpresa = verCandidatosEmpresa;
window.iniciarConversaEmpresa = iniciarConversaEmpresa;
window.fecharModalCandidatura = fecharModalCandidatura;
window.encerrarVaga = encerrarVaga;
window.listarMinhasCandidaturas = listarMinhasCandidaturas;
window.irParaChat = irParaChat;
window.abrirModalVaga = () => document.getElementById('job-post-modal').classList.remove('hidden');
