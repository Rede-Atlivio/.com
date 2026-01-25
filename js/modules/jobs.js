import { db, auth } from '../app.js';
import { userProfile } from '../auth.js';
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, getDoc, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- GATILHOS DA ABA ---
const tabEmpregos = document.getElementById('tab-empregos');
if(tabEmpregos) { 
    tabEmpregos.addEventListener('click', () => { 
        carregarInterfaceEmpregos(); 
    }); 
}

// --- CONTROLE DE INTERFACE ---
export function carregarInterfaceEmpregos() {
    const container = document.getElementById('lista-vagas');
    const containerEmpresa = document.getElementById('painel-empresa');
    
    // Se o usuário é prestador, ele vê vagas para se candidatar
    if (userProfile && userProfile.is_provider) {
        if(containerEmpresa) containerEmpresa.classList.add('hidden');
        if(container) {
            container.classList.remove('hidden');
            listarVagasParaCandidato(container);
        }
    } else {
        // Se é cliente, ele vê o painel de criar vagas
        if(container) container.classList.add('hidden');
        if(containerEmpresa) { 
            containerEmpresa.classList.remove('hidden'); 
            listarMinhasVagasEmpresa(); 
        }
    }
}

// --- FUNÇÃO 1: LISTAR VAGAS (Para quem procura emprego) ---
function listarVagasParaCandidato(container) {
    container.innerHTML = `<div class="text-center py-6 animate-fadeIn"><div class="loader mx-auto mb-2 border-blue-200 border-t-blue-600"></div><p class="text-[9px] text-gray-400">Buscando oportunidades...</p></div>`;

    // Ordena por pontuação e depois por data
    const q = query(collection(db, "jobs"), orderBy("visibility_score", "desc"), orderBy("created_at", "desc"));

    onSnapshot(q, (snap) => {
        container.innerHTML = "";
        if (snap.empty) {
            container.innerHTML = `<div class="text-center py-10 bg-white rounded-xl border border-gray-100"><p class="text-4xl mb-2">💼</p><p class="text-xs font-bold text-gray-500">Nenhuma vaga aberta hoje.</p></div>`;
            return;
        }

        snap.forEach(d => {
            const vaga = d.data();
            const isDemo = vaga.is_demo === true;
            const isEncerrada = vaga.status === 'encerrada';
            
            // Lógica Visual
            const opacityClass = isEncerrada && !isDemo ? "opacity-75 grayscale-[0.5]" : "";
            
            let badge = `<span class="bg-blue-50 text-blue-700 text-[8px] font-bold px-2 py-1 rounded uppercase">${vaga.tipo || 'CLT'}</span>`;
            if (isDemo) badge = `<span class="bg-gray-100 text-gray-500 text-[8px] px-2 py-0.5 rounded border border-gray-200 uppercase">Exemplo</span>`;
            if (isEncerrada) badge = `<span class="bg-red-100 text-red-600 text-[8px] px-2 py-0.5 rounded border border-red-200 uppercase">Preenchida</span>`;

            // Lógica do Botão
            let btnHtml = `<button onclick="window.candidatarVaga('${d.id}')" class="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase shadow hover:bg-blue-700 transition">Enviar Currículo</button>`;
            
            if (isDemo) {
                btnHtml = `<button onclick="alert('ℹ️ MODO DEMONSTRAÇÃO\\n\\nEsta é uma vaga de exemplo.')" class="bg-gray-700 text-white px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase shadow hover:bg-gray-800 transition">Ver Exemplo</button>`;
            } else if (isEncerrada) {
                btnHtml = `<button disabled class="bg-gray-200 text-gray-500 px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase cursor-not-allowed">Inscrições Encerradas</button>`;
            }

            container.innerHTML += `
                <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-3 animate-fadeIn ${opacityClass}">
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="font-black text-blue-900 text-sm uppercase">${vaga.titulo}</h3>
                        ${badge}
                    </div>
                    <p class="text-[10px] text-gray-500 mb-2 line-clamp-2">${vaga.descricao}</p>
                    <div class="flex justify-between items-center mt-3 border-t border-gray-50 pt-2">
                        <span class="text-[9px] font-bold text-green-600">R$ ${vaga.salario || 'A combinar'}</span>
                        ${btnHtml}
                    </div>
                </div>`;
        });
    });
}

// --- FUNÇÃO 2: PUBLICAR VAGA (A QUE ESTAVA FALTANDO) ---
export async function publicarVaga() {
    // 1. Pega os valores
    const tituloEl = document.getElementById('job-title');
    const salarioEl = document.getElementById('job-salary');
    const descEl = document.getElementById('job-desc');
    const btn = document.getElementById('btn-pub-job');

    if (!tituloEl || !descEl) return alert("Erro interno: Campos não encontrados.");

    const titulo = tituloEl.value;
    const salario = salarioEl.value;
    const descricao = descEl.value;

    // 2. Validação
    if (!titulo || !descricao) {
        return alert("Por favor, preencha o Título e a Descrição da vaga.");
    }

    // 3. UI de Carregamento
    if(btn) {
        btn.innerText = "PUBLICANDO...";
        btn.disabled = true;
    }

    try {
        // 4. Salva no Banco (Mesma lógica do teste que funcionou)
        await addDoc(collection(db, "jobs"), {
            titulo: titulo,
            salario: salario || "A combinar",
            descricao: descricao,
            empresa: auth.currentUser ? (auth.currentUser.displayName || "Empresa Confidencial") : "Anônimo",
            owner_id: auth.currentUser ? auth.currentUser.uid : "anon",
            tipo: "CLT",
            created_at: serverTimestamp(),
            status: "ativa",
            visibility_score: 100, // Garante que aparece no topo
            is_demo: false
        });

        alert("✅ Vaga publicada com sucesso!");
        
        // 5. Limpa e Fecha
        tituloEl.value = "";
        salarioEl.value = "";
        descEl.value = "";
        document.getElementById('job-post-modal').classList.add('hidden');
        
        // Atualiza a lista da empresa
        listarMinhasVagasEmpresa();

    } catch (e) {
        console.error("Erro ao publicar:", e);
        alert("Erro ao publicar vaga: " + e.message);
    } finally {
        if(btn) {
            btn.innerText = "PUBLICAR AGORA";
            btn.disabled = false;
        }
    }
}

// --- FUNÇÃO 3: LISTAR VAGAS DA MINHA EMPRESA ---
function listarMinhasVagasEmpresa() {
    const container = document.getElementById('lista-minhas-vagas');
    if(!container || !auth.currentUser) return;

    const q = query(collection(db, "jobs"), where("owner_id", "==", auth.currentUser.uid), orderBy("created_at", "desc"));
    
    onSnapshot(q, (snap) => {
        container.innerHTML = "";
        if (snap.empty) {
            container.innerHTML = `<p class="text-center text-xs text-gray-400 py-2">Você ainda não criou vagas.</p>`;
            return;
        }
        snap.forEach(d => {
            const v = d.data();
            container.innerHTML += `
                <div class="bg-white p-3 rounded-lg border border-gray-100 flex justify-between items-center">
                    <div>
                        <p class="font-bold text-xs text-blue-900">${v.titulo}</p>
                        <p class="text-[9px] text-gray-400">${v.status.toUpperCase()}</p>
                    </div>
                    <button class="text-[8px] text-red-400 font-bold border border-red-100 px-2 py-1 rounded">ENCERRAR</button>
                </div>
            `;
        });
    });
}

// --- FUNÇÃO 4: CANDIDATAR-SE ---
export async function candidatarVaga(jobId) {
    if(!auth.currentUser) return alert("Faça login para se candidatar.");
    
    // Verifica se já tem currículo
    const cvRef = doc(db, "candidates", auth.currentUser.uid);
    const cvSnap = await getDoc(cvRef);
    
    if (!cvSnap.exists()) { 
        // Abre modal de criar currículo se não tiver
        document.getElementById('cv-setup-modal').classList.remove('hidden'); 
        window.vagaPendenteId = jobId; 
    } else { 
        // Aplica direto
        aplicarParaVaga(jobId); 
    }
}

// --- AUXILIARES ---
export function abrirModalVaga() {
    document.getElementById('job-post-modal').classList.remove('hidden');
}

export async function salvarCurriculo() {
    const nome = document.getElementById('cv-nome').value;
    const tel = document.getElementById('cv-telefone').value;
    const hab = document.getElementById('cv-habilidades').value;
    
    if(!nome || !tel) return alert("Preencha nome e telefone.");

    try {
        await setDoc(doc(db, "candidates", auth.currentUser.uid), {
            nome: nome,
            telefone: tel,
            habilidades: hab,
            updated_at: serverTimestamp()
        });
        
        document.getElementById('cv-setup-modal').classList.add('hidden');
        alert("Currículo Salvo!");
        
        if(window.vagaPendenteId) {
            aplicarParaVaga(window.vagaPendenteId);
            window.vagaPendenteId = null;
        }
    } catch(e) {
        alert("Erro: " + e.message);
    }
}

async function aplicarParaVaga(jobId) {
    try {
        await addDoc(collection(db, `jobs/${jobId}/applications`), {
            candidate_id: auth.currentUser.uid,
            candidate_name: auth.currentUser.displayName,
            applied_at: serverTimestamp()
        });
        alert("✅ Candidatura enviada com sucesso!");
    } catch(e) {
        alert("Erro ao aplicar: " + e.message);
    }
}

// --- EXPORTAÇÃO GLOBAL (O QUE FAZ OS BOTÕES DO HTML FUNCIONAREM) ---
window.carregarInterfaceEmpregos = carregarInterfaceEmpregos;
window.abrirModalVaga = abrirModalVaga;
window.publicarVaga = publicarVaga;
window.candidatarVaga = candidatarVaga;
window.salvarCurriculo = salvarCurriculo;
