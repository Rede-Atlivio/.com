import { db, auth } from '../app.js';
import { userProfile } from '../auth.js';
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, getDoc, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// GATILHO DE ABA
const tabEmpregos = document.getElementById('tab-empregos');
if(tabEmpregos) {
    tabEmpregos.addEventListener('click', () => {
        carregarInterfaceEmpregos();
    });
}

export function carregarInterfaceEmpregos() {
    const container = document.getElementById('lista-vagas');
    const containerEmpresa = document.getElementById('painel-empresa');
    
    if(!container) return;

    // LÓGICA BIVALENTE
    // Se é Prestador -> Vê Vagas (Candidato)
    // Se é Cliente -> Posta Vagas (Empresa)
    
    if (userProfile && userProfile.is_provider) {
        // --- VISÃO CANDIDATO ---
        if(containerEmpresa) containerEmpresa.classList.add('hidden');
        container.classList.remove('hidden');
        listarVagasParaCandidato(container);
    } else {
        // --- VISÃO EMPRESA ---
        if(container) container.classList.add('hidden');
        if(containerEmpresa) {
            containerEmpresa.classList.remove('hidden');
            listarMinhasVagasEmpresa();
        }
    }
}

// --- 1. VISÃO CANDIDATO (Mural de Vagas) ---
function listarVagasParaCandidato(container) {
    container.innerHTML = `
        <div class="text-center py-6 animate-fadeIn">
            <div class="loader mx-auto mb-2 border-blue-200 border-t-blue-600"></div>
            <p class="text-[9px] text-gray-400">Buscando oportunidades...</p>
        </div>`;

    const q = query(collection(db, "jobs"), orderBy("created_at", "desc"));

    onSnapshot(q, (snap) => {
        container.innerHTML = "";
        
        if (snap.empty) {
            container.innerHTML = `
                <div class="text-center py-10 bg-white rounded-xl border border-gray-100">
                    <p class="text-4xl mb-2">💼</p>
                    <p class="text-xs font-bold text-gray-500">Nenhuma vaga aberta hoje.</p>
                    <p class="text-[9px] text-gray-400">Volte amanhã!</p>
                </div>`;
            return;
        }

        snap.forEach(d => {
            const vaga = d.data();
            container.innerHTML += `
                <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-3 animate-fadeIn">
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="font-black text-blue-900 text-sm uppercase">${vaga.titulo}</h3>
                        <span class="bg-blue-50 text-blue-700 text-[8px] font-bold px-2 py-1 rounded uppercase">${vaga.tipo || 'CLT'}</span>
                    </div>
                    <p class="text-[10px] text-gray-500 mb-2 line-clamp-2">${vaga.descricao}</p>
                    <div class="flex justify-between items-center mt-3 border-t border-gray-50 pt-2">
                        <span class="text-[9px] font-bold text-green-600">R$ ${vaga.salario || 'A combinar'}</span>
                        <button onclick="window.candidatarVaga('${d.id}')" class="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase shadow hover:bg-blue-700 transition">
                            Enviar Currículo
                        </button>
                    </div>
                </div>`;
        });
    });
}

// --- 2. AÇÃO DE CANDIDATURA ---
window.candidatarVaga = async (jobId) => {
    if(!auth.currentUser) return alert("Faça login.");
    
    // Verifica se já tem currículo
    const cvRef = doc(db, "candidates", auth.currentUser.uid);
    const cvSnap = await getDoc(cvRef);

    if (!cvSnap.exists()) {
        // Abre modal para criar CV rápido
        document.getElementById('cv-setup-modal').classList.remove('hidden');
        // Salva o ID da vaga para candidatar depois de criar
        window.vagaPendenteId = jobId; 
    } else {
        // Já tem CV, aplica direto
        aplicarParaVaga(jobId);
    }
};

window.salvarCurriculo = async () => {
    const nome = document.getElementById('cv-nome').value;
    const habilidades = document.getElementById('cv-habilidades').value;
    const telefone = document.getElementById('cv-telefone').value;

    if(!nome || !telefone) return alert("Preencha os dados básicos.");

    try {
        await setDoc(doc(db, "candidates", auth.currentUser.uid), {
            nome_completo: nome,
            habilidades: habilidades,
            telefone: telefone, // Visível apenas para empresa pagante (Futuro)
            updated_at: serverTimestamp()
        });
        
        alert("✅ Currículo Salvo!");
        document.getElementById('cv-setup-modal').classList.add('hidden');
        
        if (window.vagaPendenteId) {
            aplicarParaVaga(window.vagaPendenteId);
            window.vagaPendenteId = null;
        }
    } catch (e) {
        alert("Erro: " + e.message);
    }
};

async function aplicarParaVaga(jobId) {
    try {
        await addDoc(collection(db, "job_applications"), {
            job_id: jobId,
            candidate_id: auth.currentUser.uid,
            candidate_name: userProfile.nome_profissional || userProfile.displayName,
            applied_at: serverTimestamp(),
            status: "pending"
        });
        alert("🚀 Candidatura enviada com sucesso!");
    } catch(e) {
        alert("Erro ao aplicar: " + e.message);
    }
}

// --- 3. VISÃO EMPRESA (Postar Vaga) ---
function listarMinhasVagasEmpresa() {
    const list = document.getElementById('lista-minhas-vagas');
    if(!list) return;

    const q = query(collection(db, "jobs"), where("company_id", "==", auth.currentUser.uid), orderBy("created_at", "desc"));
    
    onSnapshot(q, (snap) => {
        list.innerHTML = "";
        if(snap.empty) {
            list.innerHTML = `<p class="text-center text-gray-400 text-xs py-4">Você ainda não postou vagas.</p>`;
        }
        snap.forEach(d => {
            const v = d.data();
            list.innerHTML += `
                <div class="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-2 flex justify-between items-center">
                    <div>
                        <p class="font-bold text-xs text-gray-800">${v.titulo}</p>
                        <p class="text-[9px] text-gray-500">${v.candidatos_count || 0} candidatos</p>
                    </div>
                    <button class="text-red-400 text-[9px] font-bold uppercase border border-red-100 px-2 py-1 rounded bg-white">Fechar</button>
                </div>`;
        });
    });
}

window.abrirModalVaga = () => {
    document.getElementById('job-post-modal').classList.remove('hidden');
};

window.publicarVaga = async () => {
    const titulo = document.getElementById('job-title').value;
    const desc = document.getElementById('job-desc').value;
    const salario = document.getElementById('job-salary').value;
    
    if(!titulo || !desc) return alert("Preencha título e descrição.");

    const btn = document.getElementById('btn-pub-job');
    btn.innerText = "Publicando...";
    btn.disabled = true;

    try {
        await addDoc(collection(db, "jobs"), {
            company_id: auth.currentUser.uid,
            company_name: userProfile.displayName || "Empresa Confidencial",
            titulo: titulo,
            descricao: desc,
            salario: salario,
            tipo: "CLT", // Padrão por enquanto
            created_at: serverTimestamp(),
            candidatos_count: 0
        });
        
        alert("✅ Vaga Publicada!");
        document.getElementById('job-post-modal').classList.add('hidden');
        // Limpar inputs...
    } catch(e) {
        alert("Erro: " + e.message);
    } finally {
        btn.innerText = "PUBLICAR AGORA";
        btn.disabled = false;
    }
};
