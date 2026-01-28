import { db, auth } from '../app.js';
import { collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp, where, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ============================================================================
// 1. ROTEADOR DE INTERFACE (QUEM VÊ O QUÊ)
// ============================================================================
export function carregarInterfaceEmpregos() {
    console.log("💼 Iniciando módulo de Vagas...");
    const containerVagas = document.getElementById('lista-vagas');
    const containerEmpresa = document.getElementById('painel-empresa');
    const userProfile = window.userProfile; 

    // Reset visual inicial
    if(containerVagas) containerVagas.classList.add('hidden');
    if(containerEmpresa) containerEmpresa.classList.add('hidden');

    if (userProfile && userProfile.is_provider) {
        // --- VISÃO DO PRESTADOR ---
        // Vê a lista de vagas para se candidatar
        if(containerVagas) {
            containerVagas.classList.remove('hidden');
            carregarVagas();
        }
    } else {
        // --- VISÃO DA EMPRESA/CLIENTE ---
        // Vê APENAS o painel de criar vagas e suas próprias vagas
        if(auth.currentUser && containerEmpresa) {
             containerEmpresa.classList.remove('hidden');
             listarMinhasVagasEmpresa();
        } else {
            // Se for visitante (sem login), mostra um teaser ou login
            if(containerVagas) {
                containerVagas.innerHTML = `<div class="text-center py-10"><p class="text-gray-400 text-xs">Faça login como Prestador para ver as vagas.</p></div>`;
                containerVagas.classList.remove('hidden');
            }
        }
    }
}

// ============================================================================
// 2. CARREGAR LISTA DE VAGAS (CANDIDATOS)
// ============================================================================
export async function carregarVagas() {
    const container = document.getElementById('lista-vagas');
    if(!container) return;
    
    container.innerHTML = `<div class="text-center py-10"><div class="loader mx-auto mb-2"></div><p class="text-xs text-gray-400">Buscando oportunidades...</p></div>`;

    try {
        const q = query(collection(db, "jobs"), orderBy("created_at", "desc"), limit(20));
        const snap = await getDocs(q);
        
        container.innerHTML = "";
        
        if (snap.empty) {
            container.innerHTML = `
                <div class="text-center py-10 opacity-50">
                    <span class="text-4xl">📭</span>
                    <p class="text-xs font-bold mt-2 uppercase">Nenhuma vaga no momento</p>
                </div>`;
            return;
        }

        snap.forEach(d => {
            const job = d.data();
            
            // Correção Undefined + Formatação
            const tituloReal = job.title || job.titulo || "Vaga Sem Título";
            const descReal = job.description || job.descricao || "Sem descrição disponível.";
            const salarioVal = job.salary || job.salario;
            const salarioFmt = salarioVal ? (isNaN(salarioVal) ? salarioVal : `R$ ${salarioVal}`) : 'A combinar';

            container.innerHTML += `
                <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition relative overflow-hidden group mb-3">
                    <div class="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
                    <div class="flex justify-between items-start mb-2 pl-2">
                        <div>
                            <h3 class="font-black text-sm text-gray-800 uppercase">${tituloReal}</h3>
                            <p class="text-[10px] text-gray-500 font-bold">${salarioFmt}</p>
                        </div>
                        <span class="text-[9px] bg-blue-50 text-blue-600 px-2 py-1 rounded font-bold uppercase">Nova</span>
                    </div>
                    <p class="text-xs text-gray-600 mb-3 pl-2 line-clamp-2">${descReal}</p>
                    <button onclick="window.candidatarVaga('${d.id}', '${tituloReal}')" class="w-full bg-slate-800 text-white py-2 rounded-lg text-xs font-bold uppercase hover:bg-blue-600 transition">
                        Candidatar-se
                    </button>
                </div>
            `;
        });

    } catch (e) {
        console.error("Erro vagas:", e);
        container.innerHTML = `<p class="text-red-500 text-xs text-center">Erro de conexão.</p>`;
    }
}

// ============================================================================
// 3. GESTÃO DA EMPRESA (PUBLICAR)
// ============================================================================
export async function publicarVaga() {
    const title = document.getElementById('job-title').value;
    const salary = document.getElementById('job-salary').value;
    const desc = document.getElementById('job-desc').value;

    if(!title || !desc) return alert("Título e Descrição obrigatórios.");

    const btn = document.getElementById('btn-pub-job');
    btn.innerText = "PUBLICANDO...";
    btn.disabled = true;

    try {
        await addDoc(collection(db, "jobs"), {
            owner_id: auth.currentUser.uid,
            title: title,       
            salary: salary,
            description: desc,  
            empresa: auth.currentUser.displayName || "Empresa",
            created_at: serverTimestamp(),
            status: 'ativa',
            candidates_count: 0
        });
        
        alert("✅ Vaga publicada com sucesso!");
        document.getElementById('job-post-modal').classList.add('hidden');
        
        document.getElementById('job-title').value = "";
        document.getElementById('job-salary').value = "";
        document.getElementById('job-desc').value = "";

        listarMinhasVagasEmpresa();

    } catch(e) {
        alert("Erro: " + e.message);
    } finally {
        btn.innerText = "PUBLICAR AGORA";
        btn.disabled = false;
    }
}

export async function listarMinhasVagasEmpresa() {
    const container = document.getElementById('lista-minhas-vagas');
    if(!container || !auth.currentUser) return;

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
        
        container.innerHTML += `
            <div class="bg-white p-3 rounded-lg border border-gray-100 flex justify-between items-center mb-2">
                <div>
                    <p class="font-bold text-xs text-blue-900">${titulo}</p>
                    <p class="text-[9px] text-gray-400">${v.status ? v.status.toUpperCase() : 'ATIVA'}</p>
                </div>
                <button class="text-[8px] text-red-400 font-bold border border-red-100 px-2 py-1 rounded">ENCERRAR</button>
            </div>
        `;
    });
}

// ============================================================================
// 4. CANDIDATURA (MODAL + PDF)
// ============================================================================
export function candidatarVaga(id, title) {
    if(!auth.currentUser) return alert("Faça login para se candidatar.");

    const modal = document.getElementById('modal-apply');
    document.getElementById('apply-job-title').innerText = title;
    document.getElementById('apply-job-id').value = id;
    
    document.getElementById('apply-message').value = "";
    document.getElementById('apply-file').value = "";

    modal.classList.remove('hidden');
    modal.classList.add('flex'); 

    const btnEnviar = document.getElementById('btn-submit-proposal');
    const newBtn = btnEnviar.cloneNode(true);
    btnEnviar.parentNode.replaceChild(newBtn, btnEnviar);
    
    newBtn.addEventListener('click', async () => {
        const msg = document.getElementById('apply-message').value;
        const fileInput = document.getElementById('apply-file');
        
        if(!fileInput.files.length) return alert("⚠️ Anexe seu currículo em PDF.");

        newBtn.innerText = "ENVIANDO...";
        newBtn.disabled = true;

        try {
            const cvUrl = "https://example.com/cv-placeholder.pdf"; 

            await addDoc(collection(db, "candidatos"), {
                vaga_id: id,
                vaga_titulo: title,
                user_id: auth.currentUser.uid,
                nome: auth.currentUser.displayName || "Candidato",
                email: auth.currentUser.email,
                mensagem: msg,
                cv_url: cvUrl,
                created_at: serverTimestamp(),
                status: 'novo'
            });

            alert(`✅ Candidatura enviada para: ${title}`);
            fecharModalCandidatura();

        } catch(e) {
            console.error(e);
            alert("Erro ao enviar: " + e.message);
        } finally {
            newBtn.innerText = "ENVIAR PROPOSTA 🚀";
            newBtn.disabled = false;
        }
    });
}

export function fecharModalCandidatura() {
    const modal = document.getElementById('modal-apply');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

// 🔥 EXPORTAÇÃO GLOBAL 🔥
window.carregarInterfaceEmpregos = carregarInterfaceEmpregos;
window.carregarVagas = carregarVagas;
window.publicarVaga = publicarVaga;
window.listarMinhasVagasEmpresa = listarMinhasVagasEmpresa;
window.candidatarVaga = candidatarVaga;
window.fecharModalCandidatura = fecharModalCandidatura;
window.abrirModalVaga = () => document.getElementById('job-post-modal').classList.remove('hidden');

console.log("✅ Módulo Jobs (Vagas) Carregado.");
