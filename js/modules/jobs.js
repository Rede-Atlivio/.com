import { db, auth } from '../app.js';
import { collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp, where, doc, getDoc, updateDoc, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ============================================================================
// 1. ROTEADOR DE INTERFACE
// ============================================================================
export function carregarInterfaceEmpregos() {
    console.log("💼 Iniciando módulo de Vagas...");
    const containerVagas = document.getElementById('lista-vagas');
    const containerEmpresa = document.getElementById('painel-empresa');
    const userProfile = window.userProfile; 

    // Reset visual
    if(containerVagas) containerVagas.classList.add('hidden');
    if(containerEmpresa) containerEmpresa.classList.add('hidden');

    if (!auth.currentUser) {
        if(containerVagas) {
            containerVagas.innerHTML = `<div class="text-center py-10"><p class="text-gray-400 text-xs">Faça login para acessar vagas.</p></div>`;
            containerVagas.classList.remove('hidden');
        }
        return;
    }

    if (userProfile && userProfile.is_provider) {
        // --- VISÃO DO PRESTADOR (CANDIDATO) ---
        if(containerVagas) {
            containerVagas.classList.remove('hidden');
            // Cria abas para o candidato
            containerVagas.innerHTML = `
                <div class="flex gap-4 mb-4 border-b border-gray-100 pb-2">
                    <button onclick="window.carregarVagas()" class="text-blue-600 font-bold text-xs uppercase border-b-2 border-blue-600 pb-1">Vagas Abertas</button>
                    <button onclick="window.listarMinhasCandidaturas()" class="text-gray-400 font-bold text-xs uppercase hover:text-blue-600 transition pb-1">Minhas Candidaturas</button>
                </div>
                <div id="vagas-content"></div>
            `;
            carregarVagas();
        }
    } else {
        // --- VISÃO DA EMPRESA (DONO DA VAGA) ---
        if(containerEmpresa) {
             containerEmpresa.classList.remove('hidden');
             listarMinhasVagasEmpresa();
        }
    }
}

// ============================================================================
// 2. PRESTADOR: VER VAGAS E CANDIDATURAS
// ============================================================================
export async function carregarVagas() {
    const container = document.getElementById('vagas-content');
    if(!container) return;
    
    container.innerHTML = `<div class="text-center py-10"><div class="loader mx-auto mb-2"></div><p class="text-xs text-gray-400">Buscando vagas...</p></div>`;

    try {
        // Mostra apenas vagas ATIVAS
        const q = query(collection(db, "jobs"), where("status", "==", "ativa"), orderBy("created_at", "desc"), limit(20));
        const snap = await getDocs(q);
        
        container.innerHTML = "";
        
        if (snap.empty) {
            container.innerHTML = `<div class="text-center py-10 opacity-50"><span class="text-4xl">📭</span><p class="text-xs font-bold mt-2">Nenhuma vaga aberta.</p></div>`;
            return;
        }

        snap.forEach(d => {
            const job = d.data();
            const titulo = job.title || job.titulo || "Vaga";
            
            container.innerHTML += `
                <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition mb-3">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <h3 class="font-black text-sm text-gray-800 uppercase">${titulo}</h3>
                            <p class="text-[10px] text-gray-500 font-bold">${job.company || 'Empresa Confidencial'}</p>
                        </div>
                        <span class="text-[9px] bg-green-50 text-green-600 px-2 py-1 rounded font-bold uppercase">R$ ${job.salary || 'Combinar'}</span>
                    </div>
                    <p class="text-xs text-gray-600 mb-3 line-clamp-2">${job.description}</p>
                    <div class="flex gap-2">
                        <button onclick="window.candidatarVaga('${d.id}', '${titulo}', '${job.owner_id}')" class="flex-1 bg-slate-900 text-white py-2 rounded-lg text-xs font-bold uppercase hover:bg-blue-600 transition">
                            Candidatar-se
                        </button>
                        <button onclick="window.iniciarChat('${job.owner_id}', '${job.empresa}')" class="bg-blue-50 text-blue-600 px-3 py-2 rounded-lg text-xs font-bold hover:bg-blue-100">
                            💬
                        </button>
                    </div>
                </div>
            `;
        });
    } catch (e) { container.innerHTML = `<p class="text-red-500 text-xs">Erro ao carregar vagas.</p>`; console.error(e); }
}

export async function listarMinhasCandidaturas() {
    const container = document.getElementById('vagas-content');
    container.innerHTML = `<div class="text-center py-10"><div class="loader mx-auto"></div></div>`;

    try {
        const q = query(collection(db, "job_applications"), where("user_id", "==", auth.currentUser.uid), orderBy("created_at", "desc"));
        const snap = await getDocs(q);

        container.innerHTML = "";
        if (snap.empty) {
            container.innerHTML = `<p class="text-center text-xs text-gray-400 py-6">Você não se candidatou a nada.</p>`;
            return;
        }

        snap.forEach(d => {
            const app = d.data();
            container.innerHTML += `
                <div class="bg-white p-3 rounded-lg border border-gray-200 mb-2 flex justify-between items-center">
                    <div>
                        <p class="font-bold text-xs text-blue-900">${app.vaga_titulo}</p>
                        <p class="text-[9px] text-gray-400">Enviado em: ${app.created_at?.toDate().toLocaleDateString()}</p>
                    </div>
                    <button onclick="window.desistirVaga('${d.id}')" class="text-[9px] text-red-500 border border-red-200 px-2 py-1 rounded hover:bg-red-50">DESISTIR</button>
                </div>
            `;
        });
    } catch (e) { console.error(e); container.innerHTML = "Erro ao buscar candidaturas."; }
}

// ============================================================================
// 3. EMPRESA: GERIR VAGAS E ENCERRAR
// ============================================================================
export async function listarMinhasVagasEmpresa() {
    const container = document.getElementById('lista-minhas-vagas');
    if(!container || !auth.currentUser) return;

    // Busca vagas criadas pelo usuário logado
    const q = query(collection(db, "jobs"), where("owner_id", "==", auth.currentUser.uid), orderBy("created_at", "desc"));
    const snap = await getDocs(q);
    
    container.innerHTML = "";
    if (snap.empty) { 
        container.innerHTML = `<p class="text-center text-xs text-gray-400 py-2">Você ainda não criou vagas.</p>`; 
        return; 
    }
    
    snap.forEach(d => {
        const v = d.data();
        const titulo = v.title || v.titulo || "Sem Título";
        const isAtiva = v.status === 'ativa';
        
        container.innerHTML += `
            <div class="bg-white p-3 rounded-lg border border-gray-100 mb-2">
                <div class="flex justify-between items-center mb-2">
                    <div>
                        <p class="font-bold text-xs text-blue-900">${titulo}</p>
                        <p class="text-[9px] ${isAtiva ? 'text-green-500' : 'text-red-400'} font-bold uppercase">${v.status || 'ativa'}</p>
                    </div>
                    ${isAtiva ? 
                        `<button onclick="window.encerrarVaga('${d.id}')" class="text-[8px] bg-red-50 text-red-500 font-bold border border-red-100 px-2 py-1 rounded hover:bg-red-100">ENCERRAR VAGA</button>` 
                        : `<span class="text-[8px] text-gray-400">Encerrada</span>`
                    }
                </div>
                <div class="bg-gray-50 p-2 rounded text-[10px] text-gray-500 flex justify-between items-center">
                    <span>📄 Candidatos interessados</span>
                    </div>
            </div>
        `;
    });
}

export async function encerrarVaga(id) {
    if(!confirm("Tem certeza que deseja encerrar esta vaga? Ela sairá da lista.")) return;
    try {
        await updateDoc(doc(db, "jobs", id), { status: 'encerrada' });
        alert("Vaga encerrada.");
        listarMinhasVagasEmpresa();
    } catch(e) { alert("Erro: " + e.message); }
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
            owner_id: auth.currentUser.uid,
            title: title,        
            titulo: title, // Duplo para garantir compatibilidade
            salary: salary,
            description: desc,   
            empresa: auth.currentUser.displayName || "Empresa",
            created_at: serverTimestamp(),
            status: 'ativa',
            is_demo: false
        });
        alert("✅ Vaga publicada!");
        document.getElementById('job-post-modal').classList.add('hidden');
        // Limpa campos
        document.getElementById('job-title').value = "";
        document.getElementById('job-desc').value = "";
        listarMinhasVagasEmpresa();
    } catch(e) { alert(e.message); } finally { btn.innerText = "PUBLICAR"; btn.disabled = false; }
}

// ============================================================================
// 4. AÇÕES DE INTERAÇÃO (CANDIDATAR, DESISTIR, CHAT)
// ============================================================================

// CANDIDATAR (AGORA SALVA EM 'job_applications' PARA O ADMIN VER)
export function candidatarVaga(id, title, ownerId) {
    if(!auth.currentUser) return alert("Faça login.");

    const modal = document.getElementById('modal-apply');
    document.getElementById('apply-job-title').innerText = title;
    
    // Configura o botão de envio
    const btnEnviar = document.getElementById('btn-submit-proposal');
    // Remove listeners antigos clonando o botão
    const newBtn = btnEnviar.cloneNode(true);
    btnEnviar.parentNode.replaceChild(newBtn, btnEnviar);
    
    modal.classList.remove('hidden');
    modal.classList.add('flex'); 

    newBtn.addEventListener('click', async () => {
        const msg = document.getElementById('apply-message').value;
        const fileInput = document.getElementById('apply-file');
        
        // Simulação de Upload (Para funcionar real precisa do Storage)
        const fakeUrl = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"; 

        newBtn.innerText = "ENVIANDO...";
        newBtn.disabled = true;

        try {
            // 🔥 CORREÇÃO CRUCIAL: Nome da coleção igual ao do Admin
            await addDoc(collection(db, "job_applications"), {
                job_id: id,           // ID para o Admin buscar
                vaga_id: id,          // Backup
                vaga_titulo: title,
                owner_id: ownerId,    // Dono da vaga
                user_id: auth.currentUser.uid,
                user_name: auth.currentUser.displayName || "Candidato",
                user_phone: auth.currentUser.phoneNumber || "",
                message: msg,
                resume_url: fakeUrl,  // URL do PDF
                created_at: serverTimestamp(),
                status: 'novo'
            });

            alert(`✅ Candidatura enviada para: ${title}`);
            fecharModalCandidatura();
            // Abre chat automaticamente
            if(confirm("Deseja mandar um 'Oi' para a empresa agora?")) {
                iniciarChat(ownerId, "Empresa da Vaga");
            }

        } catch(e) {
            console.error(e);
            alert("Erro ao enviar: " + e.message);
        } finally {
            newBtn.innerText = "ENVIAR PROPOSTA";
            newBtn.disabled = false;
        }
    });
}

export async function desistirVaga(appId) {
    if(!confirm("Remover sua candidatura?")) return;
    try {
        await deleteDoc(doc(db, "job_applications", appId));
        listarMinhasCandidaturas();
    } catch(e) { alert(e.message); }
}

export function fecharModalCandidatura() {
    const modal = document.getElementById('modal-apply');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

// CHAT (INTEGRAÇÃO COM O MÓDULO EXISTENTE)
export async function iniciarChat(targetUid, targetName) {
    console.log(`💬 Iniciando chat com ${targetName} (${targetUid})`);
    
    // Tenta criar/encontrar a sala de chat
    // Nota: Estamos assumindo que existe uma lógica de chats. 
    // Aqui criamos o documento básico para garantir que o chat apareça na lista.
    try {
        const chatID = [auth.currentUser.uid, targetUid].sort().join("_");
        const chatRef = doc(db, "chats", chatID);
        
        await setDoc(chatRef, {
            users: [auth.currentUser.uid, targetUid],
            user_names: [auth.currentUser.displayName, targetName],
            last_msg: "Nova conexão de vaga",
            last_time: serverTimestamp()
        }, { merge: true });

        // Redireciona para a aba de chat (assumindo que o app tem tabs)
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        const chatTab = document.querySelector('[data-target="chat"]');
        if(chatTab) {
            chatTab.click();
            chatTab.classList.add('active');
        } else {
            alert("Chat iniciado! Vá para a aba de Mensagens.");
        }

    } catch(e) {
        console.error("Erro ao abrir chat:", e);
        alert("Erro ao abrir chat.");
    }
}

// EXPORTAÇÃO GLOBAL
window.carregarInterfaceEmpregos = carregarInterfaceEmpregos;
window.carregarVagas = carregarVagas;
window.publicarVaga = publicarVaga;
window.listarMinhasVagasEmpresa = listarMinhasVagasEmpresa;
window.candidatarVaga = candidatarVaga;
window.desistirVaga = desistirVaga;
window.encerrarVaga = encerrarVaga;
window.iniciarChat = iniciarChat;
window.fecharModalCandidatura = fecharModalCandidatura;
window.listarMinhasCandidaturas = listarMinhasCandidaturas;
window.abrirModalVaga = () => document.getElementById('job-post-modal').classList.remove('hidden');

console.log("✅ Módulo Jobs (Site) Atualizado e Sincronizado.");
