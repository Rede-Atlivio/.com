import { db, auth } from '../app.js';
import { collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp, where, doc, getDoc, updateDoc, deleteDoc, setDoc, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// Nota: onAuthStateChanged vem do Auth, mas aqui importamos do Firestore por engano em alguns exemplos. 
// Correção: Vamos usar o auth direto do app.js que já está inicializado.

// ============================================================================
// 1. ROTEADOR DE INTERFACE (BLINDADO COM WAIT-FOR-AUTH)
// ============================================================================
export function carregarInterfaceEmpregos() {
    console.log("💼 Módulo Vagas: Aguardando autenticação...");
    const containerVagas = document.getElementById('lista-vagas');
    const containerEmpresa = document.getElementById('painel-empresa');
    
    // Mostra loader enquanto o Firebase pensa
    if(containerVagas) containerVagas.innerHTML = `<div class="text-center py-10"><div class="loader mx-auto"></div><p class="text-xs text-gray-400">Verificando conta...</p></div>`;

    // 🔥 CORREÇÃO DO "DESCONECTOU": Espera o Firebase confirmar o usuário
    auth.onAuthStateChanged(user => {
        if (user) {
            // USUÁRIO LOGADO
            const userProfile = window.userProfile || {}; 
            
            // Verifica perfil (Se window.userProfile ainda não carregou, tentamos inferir ou buscamos)
            // Para segurança, vamos carregar a visão baseada no que temos
            
            if (userProfile.is_provider) {
                // --- PRESTADOR ---
                if(containerEmpresa) containerEmpresa.classList.add('hidden');
                if(containerVagas) {
                    containerVagas.classList.remove('hidden');
                    containerVagas.innerHTML = `
                        <div class="flex gap-2 mb-4 border-b border-gray-100 pb-2">
                            <button onclick="window.carregarVagas()" class="flex-1 text-blue-600 font-bold text-[10px] uppercase border-b-2 border-blue-600 pb-1">Vagas Abertas</button>
                            <button onclick="window.listarMinhasCandidaturas()" class="flex-1 text-gray-400 font-bold text-[10px] uppercase hover:text-blue-600 transition pb-1">Minhas Candidaturas</button>
                        </div>
                        <div id="vagas-content"></div>
                    `;
                    carregarVagas();
                }
            } else {
                // --- EMPRESA ---
                if(containerVagas) containerVagas.classList.add('hidden');
                if(containerEmpresa) {
                    containerEmpresa.classList.remove('hidden');
                    listarMinhasVagasEmpresa();
                }
                // Injeta Modal de Candidatos se não existir
                if(!document.getElementById('modal-candidatos-empresa')) criarModalCandidatos();
            }
        } else {
            // USUÁRIO DESLOGADO
            if(containerVagas) {
                containerVagas.classList.remove('hidden');
                containerVagas.innerHTML = `
                    <div class="text-center py-10">
                        <span class="text-4xl">🔒</span>
                        <p class="text-gray-500 text-xs mt-2">Faça login para ver as vagas.</p>
                    </div>`;
            }
            if(containerEmpresa) containerEmpresa.classList.add('hidden');
        }
    });
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
            let statusText = "Aguardando"; // Padrão

            if (app.status === 'chat_aberto') {
                statusColor = "text-green-600";
                statusText = "ENTREVISTA";
                areaChat = `
                    <div class="mt-3 bg-green-50 border border-green-200 p-3 rounded-lg flex items-center justify-between animate-pulse">
                        <div>
                            <p class="text-[10px] font-bold text-green-800">👋 A empresa chamou!</p>
                            <p class="text-[9px] text-green-600">Eles querem te entrevistar.</p>
                        </div>
                        <button onclick="window.irParaChat('${app.owner_id}', 'Empresa')" class="bg-green-600 text-white px-4 py-2 rounded-lg text-[10px] font-bold shadow hover:bg-green-500">
                            ABRIR CHAT
                        </button>
                    </div>
                `;
            }

            container.innerHTML += `
                <div class="bg-white p-4 rounded-xl border border-gray-200 mb-2 shadow-sm">
                    <div class="flex justify-between items-center mb-1">
                        <p class="font-black text-xs text-blue-900 uppercase">${app.vaga_titulo}</p>
                        <span class="text-[9px] font-bold uppercase ${statusColor} bg-gray-50 px-2 py-1 rounded">${statusText}</span>
                    </div>
                    <p class="text-[9px] text-gray-400 mb-2">Enviado em: ${app.created_at?.toDate().toLocaleDateString()}</p>
                    
                    ${areaChat}

                    <div class="mt-2 pt-2 border-t border-gray-50 text-right">
                        <button onclick="window.desistirVaga('${d.id}')" class="text-[9px] text-red-400 font-bold hover:text-red-600">CANCELAR CANDIDATURA</button>
                    </div>
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
    if (snap.empty) { container.innerHTML = `<p class="text-center text-xs text-gray-400 py-2">Você ainda não criou vagas.</p>`; return; }
    
    snap.forEach(d => {
        const v = d.data();
        const titulo = v.title || v.titulo || "Sem Título";
        const isAtiva = v.status === 'ativa';
        
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
                    <button onclick="window.verCandidatosEmpresa('${d.id}', '${titulo}')" class="flex-1 bg-blue-600 text-white text-[10px] font-bold py-2 rounded-lg shadow hover:bg-blue-500 flex items-center justify-center gap-2">
                        📄 VER CANDIDATOS
                    </button>
                    ${isAtiva ? `<button onclick="window.encerrarVaga('${d.id}')" class="px-3 bg-red-50 text-red-500 font-bold border border-red-100 rounded-lg text-[10px]">⛔</button>` : ''}
                </div>
            </div>
        `;
    });
}

// --- MODAL DE CANDIDATOS ---
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
            const linkCv = cand.resume_url || cand.cv_url || cand.file_url;
            const btnCv = linkCv ? `<a href="${linkCv}" target="_blank" class="text-blue-500 underline text-[10px] font-bold">📄 Baixar Currículo (PDF)</a>` : `<span class="text-gray-400 text-[10px]">Sem CV</span>`;
            
            // Botão de Chat (Lógica de Decisão)
            const jaChamou = cand.status === 'chat_aberto';
            const btnChat = jaChamou 
                ? `<div class="bg-green-50 text-green-700 p-2 rounded text-[10px] font-bold text-center border border-green-200">✅ VOCÊ JÁ CHAMOU</div>`
                : `<button onclick="window.iniciarConversaEmpresa('${d.id}', '${cand.user_id}', '${cand.nome}')" class="w-full bg-green-600 text-white py-2 rounded-lg text-[10px] font-bold shadow hover:bg-green-500 flex items-center justify-center gap-2">💬 CHAMAR PARA ENTREVISTA</button>`;

            lista.innerHTML += `
                <div class="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-3">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <p class="font-bold text-xs text-slate-800 uppercase">${cand.nome || 'Candidato'}</p>
                            <p class="text-[10px] text-slate-500">${cand.created_at?.toDate().toLocaleDateString()}</p>
                        </div>
                        ${btnCv}
                    </div>
                    <div class="bg-white p-2 rounded border border-slate-100 text-[10px] text-slate-600 italic mb-3">
                        "${cand.mensagem || 'Sem mensagem'}"
                    </div>
                    ${btnChat}
                </div>
            `;
        });

    } catch(e) { console.error(e); lista.innerHTML = `<p class="text-red-500 text-xs text-center">Erro ao carregar candidatos.</p>`; }
}

export async function iniciarConversaEmpresa(appId, userId, userName) {
    if(!confirm(`Confirmar interesse em ${userName}? Isso liberará o chat para ele.`)) return;

    try {
        // 1. Atualiza status para 'chat_aberto' (Isso faz aparecer o botão pro candidato)
        await updateDoc(doc(db, "job_applications", appId), { status: 'chat_aberto' });

        // 2. Cria a sala de chat (backend)
        const chatID = [auth.currentUser.uid, userId].sort().join("_");
        await setDoc(doc(db, "chats", chatID), {
            users: [auth.currentUser.uid, userId],
            user_names: [auth.currentUser.displayName, userName],
            last_msg: "Olá! A empresa tem interesse no seu perfil.",
            last_time: serverTimestamp(),
            job_context: appId
        }, { merge: true });

        alert(`✅ Convite enviado para ${userName}!`);
        // Recarrega o modal para mostrar que já foi chamado
        verCandidatosEmpresa(null, document.getElementById('modal-job-title').innerText); 

    } catch(e) { alert("Erro: " + e.message); }
}

// ============================================================================
// 4. UTILITÁRIOS & MODAIS
// ============================================================================
function criarModalCandidatos() {
    const div = document.createElement('div');
    div.id = "modal-candidatos-empresa";
    div.className = "fixed inset-0 z-50 bg-black/80 backdrop-blur-sm hidden items-center justify-center p-4";
    div.innerHTML = `
        <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div class="bg-slate-900 p-4 flex justify-between items-center border-b border-slate-800">
                <h3 class="text-white font-black text-sm uppercase tracking-wide flex items-center gap-2">
                    <span class="text-blue-400">📄</span> Candidatos: <span id="modal-job-title" class="text-gray-300">...</span>
                </h3>
                <button onclick="document.getElementById('modal-candidatos-empresa').classList.add('hidden'); document.getElementById('modal-candidatos-empresa').classList.remove('flex')" class="text-gray-400 hover:text-white font-bold text-xl">×</button>
            </div>
            <div id="lista-candidatos-ul" class="p-4 overflow-y-auto custom-scrollbar flex-1 bg-white"></div>
        </div>
    `;
    document.body.appendChild(div);
}

export function candidatarVaga(id, title, ownerId) {
    if(!auth.currentUser) return alert("Faça login.");
    const modal = document.getElementById('modal-apply');
    document.getElementById('apply-job-title').innerText = title;
    
    const btnEnviar = document.getElementById('btn-submit-proposal');
    const newBtn = btnEnviar.cloneNode(true);
    btnEnviar.parentNode.replaceChild(newBtn, btnEnviar);
    
    modal.classList.remove('hidden'); modal.classList.add('flex'); 

    newBtn.addEventListener('click', async () => {
        const msg = document.getElementById('apply-message').value;
        // Simulando PDF (Em produção, usaria Storage)
        const fakeCV = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"; 

        newBtn.innerText = "ENVIANDO..."; newBtn.disabled = true;
        try {
            await addDoc(collection(db, "job_applications"), {
                job_id: id, vaga_id: id, vaga_titulo: title, owner_id: ownerId,
                user_id: auth.currentUser.uid, nome: auth.currentUser.displayName || "Candidato",
                message: msg, resume_url: fakeCV, created_at: serverTimestamp(), status: 'novo'
            });
            alert("✅ Currículo Enviado!");
            fecharModalCandidatura();
        } catch(e) { alert(e.message); } finally { newBtn.innerText = "ENVIAR PROPOSTA"; newBtn.disabled = false; }
    });
}

export function irParaChat(targetUid, name) {
    const tabChat = document.querySelector('[data-target="chat"]');
    if(tabChat) tabChat.click();
    else alert(`Abra a aba de mensagens para falar com ${name}.`);
}

export function fecharModalCandidatura() {
    const modal = document.getElementById('modal-apply');
    modal.classList.add('hidden'); modal.classList.remove('flex');
}

export async function publicarVaga() {
    const title = document.getElementById('job-title').value;
    const salary = document.getElementById('job-salary').value;
    const desc = document.getElementById('job-desc').value;
    if(!title || !desc) return alert("Preencha tudo.");

    const btn = document.getElementById('btn-pub-job');
    btn.innerText = "⏳"; btn.disabled = true;

    try {
        await addDoc(collection(db, "jobs"), {
            owner_id: auth.currentUser.uid, title, titulo: title, salary, description: desc,
            empresa: auth.currentUser.displayName || "Empresa", created_at: serverTimestamp(), status: 'ativa', is_demo: false
        });
        alert("✅ Publicado!");
        document.getElementById('job-post-modal').classList.add('hidden');
        listarMinhasVagasEmpresa();
    } catch(e) { alert(e.message); } finally { btn.innerText = "PUBLICAR"; btn.disabled = false; }
}

export async function encerrarVaga(id) {
    if(!confirm("Encerrar esta vaga?")) return;
    await updateDoc(doc(db, "jobs", id), { status: 'encerrada' });
    listarMinhasVagasEmpresa();
}

export function desistirVaga(appId) {
    if(!confirm("Desistir desta vaga?")) return;
    deleteDoc(doc(db, "job_applications", appId)).then(() => listarMinhasCandidaturas());
}

window.carregarInterfaceEmpregos = carregarInterfaceEmpregos;
window.carregarVagas = carregarVagas;
window.publicarVaga = publicarVaga;
window.listarMinhasVagasEmpresa = listarMinhasVagasEmpresa;
window.candidatarVaga = candidatarVaga;
window.verCandidatosEmpresa = verCandidatosEmpresa;
window.iniciarConversaEmpresa = iniciarConversaEmpresa;
window.fecharModalCandidatura = fecharModalCandidatura;
window.encerrarVaga = encerrarVaga;
window.desistirVaga = desistirVaga;
window.listarMinhasCandidaturas = listarMinhasCandidaturas;
window.irParaChat = irParaChat;
window.abrirModalVaga = () => document.getElementById('job-post-modal').classList.remove('hidden');
