import { db, auth } from '../app.js';
import { userProfile } from '../auth.js';
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- GATILHOS DA ABA ---
const tabEmpregos = document.getElementById('tab-empregos');
if(tabEmpregos) { 
    tabEmpregos.addEventListener('click', () => { 
        carregarInterfaceEmpregos(); 
    }); 
}

// ============================================================================
// 1. CONTROLE DE INTERFACE (PAINEL EMPRESA vs PRESTADOR)
// ============================================================================
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
        // Se é cliente/empresa, ele vê o painel de criar vagas
        if(container) container.classList.add('hidden');
        if(containerEmpresa) { 
            containerEmpresa.classList.remove('hidden'); 
            listarMinhasVagasEmpresa(); 
        }
    }
}

// ============================================================================
// 2. LISTAR VAGAS PARA O PRESTADOR (VISÃO DO CANDIDATO)
// ============================================================================
function listarVagasParaCandidato(container) {
    container.innerHTML = `<div class="text-center py-6 animate-fadeIn"><div class="loader mx-auto mb-2 border-blue-200 border-t-blue-600"></div><p class="text-[9px] text-gray-400">Buscando oportunidades...</p></div>`;

    // Busca vagas ativas ordenadas por data
    const q = query(collection(db, "jobs"), where("status", "==", "ativa"), orderBy("created_at", "desc"));

    onSnapshot(q, (snap) => {
        container.innerHTML = "";
        if (snap.empty) {
            container.innerHTML = `<div class="text-center py-10 bg-white rounded-xl border border-gray-100"><p class="text-4xl mb-2">💼</p><p class="text-xs font-bold text-gray-500">Nenhuma vaga aberta hoje.</p></div>`;
            return;
        }

        snap.forEach(d => {
            const vaga = d.data();
            const id = d.id;
            const isDemo = vaga.is_demo === true;
            
            // Badge visual
            let badge = `<span class="bg-blue-50 text-blue-700 text-[8px] font-bold px-2 py-1 rounded uppercase">${vaga.tipo || 'CLT'}</span>`;
            if (isDemo) badge = `<span class="bg-purple-100 text-purple-600 text-[8px] px-2 py-0.5 rounded border border-purple-200 uppercase">DEMO</span>`;

            // Lógica: Botão chama o NOVO modal de PDF
            const btnHtml = `<button onclick="window.abrirModalCandidatura('${id}', '${vaga.titulo}')" class="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase shadow hover:bg-blue-700 transition">Enviar Proposta 🚀</button>`;

            container.innerHTML += `
                <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-3 animate-fadeIn">
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="font-black text-blue-900 text-sm uppercase">${vaga.titulo}</h3>
                        ${badge}
                    </div>
                    <p class="text-[9px] text-gray-400 font-bold uppercase mb-1">${vaga.empresa || "Confidencial"}</p>
                    <p class="text-[10px] text-gray-500 mb-2 line-clamp-2">${vaga.descricao}</p>
                    <div class="flex justify-between items-center mt-3 border-t border-gray-50 pt-2">
                        <span class="text-[9px] font-bold text-green-600">R$ ${vaga.salario || 'A combinar'}</span>
                        ${btnHtml}
                    </div>
                </div>`;
        });
    });
}

// ============================================================================
// 3. PUBLICAR VAGA (VISÃO DA EMPRESA)
// ============================================================================
export async function publicarVaga() {
    const tituloEl = document.getElementById('job-title');
    const salarioEl = document.getElementById('job-salary');
    const descEl = document.getElementById('job-desc');
    const btn = document.getElementById('btn-pub-job');

    if (!tituloEl || !descEl) return alert("Erro interno: Campos não encontrados.");

    const titulo = tituloEl.value;
    const salario = salarioEl.value;
    const descricao = descEl.value;

    if (!titulo || !descricao) return alert("Por favor, preencha Título e Descrição.");

    if(btn) { btn.innerText = "PUBLICANDO..."; btn.disabled = true; }

    try {
        await addDoc(collection(db, "jobs"), {
            titulo: titulo,
            salario: salario || "A combinar",
            descricao: descricao,
            empresa: auth.currentUser ? (auth.currentUser.displayName || "Empresa Confidencial") : "Anônimo",
            owner_id: auth.currentUser ? auth.currentUser.uid : "anon",
            tipo: "CLT",
            created_at: serverTimestamp(),
            status: "ativa",
            visibility_score: 100, 
            is_demo: false // Vaga Real
        });

        alert("✅ Vaga publicada com sucesso!");
        
        tituloEl.value = ""; salarioEl.value = ""; descEl.value = "";
        document.getElementById('job-post-modal').classList.add('hidden');
        listarMinhasVagasEmpresa();

    } catch (e) {
        console.error("Erro ao publicar:", e);
        alert("Erro: " + e.message);
    } finally {
        if(btn) { btn.innerText = "PUBLICAR AGORA"; btn.disabled = false; }
    }
}

function listarMinhasVagasEmpresa() {
    const container = document.getElementById('lista-minhas-vagas');
    if(!container || !auth.currentUser) return;

    const q = query(collection(db, "jobs"), where("owner_id", "==", auth.currentUser.uid), orderBy("created_at", "desc"));
    
    onSnapshot(q, (snap) => {
        container.innerHTML = "";
        if (snap.empty) { container.innerHTML = `<p class="text-center text-xs text-gray-400 py-2">Você ainda não criou vagas.</p>`; return; }
        
        snap.forEach(d => {
            const v = d.data();
            container.innerHTML += `
                <div class="bg-white p-3 rounded-lg border border-gray-100 flex justify-between items-center mb-2">
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

// ============================================================================
// 4. NOVA LÓGICA DE CANDIDATURA (MODAL + PDF)
// ============================================================================

// Ação Global: Abre o Modal
window.abrirModalCandidatura = (vagaId, vagaTitulo) => {
    if(!auth.currentUser) return alert("Faça login para se candidatar.");

    const modal = document.getElementById('modal-apply');
    if (!modal) return alert("Erro: Modal 'modal-apply' não encontrado no HTML. Verifique o index.html.");

    // Reseta form
    document.getElementById('apply-message').value = "";
    document.getElementById('apply-file').value = "";

    // Preenche dados ocultos
    document.getElementById('apply-job-id').value = vagaId;
    document.getElementById('apply-job-title').innerText = vagaTitulo;
    
    // Mostra
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    // Listener do botão enviar (remover anteriores para não duplicar)
    const btnEnviar = document.getElementById('btn-submit-proposal');
    const newBtn = btnEnviar.cloneNode(true);
    btnEnviar.parentNode.replaceChild(newBtn, btnEnviar);
    newBtn.addEventListener('click', enviarCandidaturaReal);
};

// Ação Global: Envia para o Admin
async function enviarCandidaturaReal() {
    const btn = document.getElementById('btn-submit-proposal');
    const txtOriginal = btn.innerText;
    
    const vagaId = document.getElementById('apply-job-id').value;
    const vagaTitulo = document.getElementById('apply-job-title').innerText;
    const msg = document.getElementById('apply-message')?.value || "";
    const fileInput = document.getElementById('apply-file');

    // Validação
    if(!fileInput.files.length) {
        return alert("⚠️ Por favor, anexe seu currículo em PDF.");
    }

    btn.innerText = "ENVIANDO...";
    btn.disabled = true;

    try {
        // Link Fake do PDF (No MVP não temos Storage, o Admin sabe disso)
        // Em produção, aqui faríamos uploadBytes() para o Storage
        let cvUrl = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"; 

        // CRUCIAL: Salva na coleção 'candidatos' (onde o Admin lê)
        await addDoc(collection(db, "candidatos"), {
            vaga_id: vagaId,
            vaga_titulo: vagaTitulo,
            user_id: auth.currentUser.uid,
            nome_candidato: auth.currentUser.displayName || auth.currentUser.email,
            email_candidato: auth.currentUser.email,
            mensagem: msg,
            cv_url: cvUrl, 
            created_at: serverTimestamp(),
            status: "novo",
            is_demo: false
        });

        alert(`✅ Sucesso! Proposta enviada para "${vagaTitulo}".`);
        window.fecharModalCandidatura();

    } catch (e) {
        console.error(e);
        alert("Erro ao enviar: " + e.message);
    } finally {
        btn.innerText = txtOriginal;
        btn.disabled = false;
    }
}

window.fecharModalCandidatura = () => {
    const modal = document.getElementById('modal-apply');
    if(modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

// --- EXPORTAÇÃO GLOBAL (API) ---
window.carregarInterfaceEmpregos = carregarInterfaceEmpregos;
window.publicarVaga = publicarVaga;
// Abrir modal de criação de vaga (empresa)
window.abrirModalVaga = () => document.getElementById('job-post-modal').classList.remove('hidden');
