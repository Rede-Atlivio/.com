import { db, auth } from '../app.js';
import { userProfile } from '../auth.js';
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, getDoc, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const tabEmpregos = document.getElementById('tab-empregos');
if(tabEmpregos) { tabEmpregos.addEventListener('click', () => { carregarInterfaceEmpregos(); }); }

export function carregarInterfaceEmpregos() {
    const container = document.getElementById('lista-vagas');
    const containerEmpresa = document.getElementById('painel-empresa');
    if(!container) return;

    if (userProfile && userProfile.is_provider) {
        if(containerEmpresa) containerEmpresa.classList.add('hidden');
        container.classList.remove('hidden');
        listarVagasParaCandidato(container);
    } else {
        if(container) container.classList.add('hidden');
        if(containerEmpresa) { containerEmpresa.classList.remove('hidden'); listarMinhasVagasEmpresa(); }
    }
}

function listarVagasParaCandidato(container) {
    container.innerHTML = `<div class="text-center py-6 animate-fadeIn"><div class="loader mx-auto mb-2 border-blue-200 border-t-blue-600"></div><p class="text-[9px] text-gray-400">Buscando oportunidades...</p></div>`;

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
            
            // Visual Logic
            const opacityClass = isEncerrada && !isDemo ? "opacity-75 grayscale-[0.5]" : "";
            const badge = isDemo 
                ? `<span class="bg-gray-100 text-gray-500 text-[8px] px-2 py-0.5 rounded border border-gray-200 uppercase">Exemplo</span>` 
                : (isEncerrada ? `<span class="bg-red-100 text-red-600 text-[8px] px-2 py-0.5 rounded border border-red-200 uppercase">Preenchida</span>` 
                : `<span class="bg-blue-50 text-blue-700 text-[8px] font-bold px-2 py-1 rounded uppercase">${vaga.tipo || 'CLT'}</span>`);

            // Button Logic
            let btnHtml = '';
            if (isDemo) {
                // Educational Button for Demos
                btnHtml = `<button onclick="alert('ℹ️ MODO DEMONSTRAÇÃO\\n\\nEsta é uma vaga de exemplo para você entender como as oportunidades aparecerão aqui.')" class="bg-gray-700 text-white px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase shadow hover:bg-gray-800 transition">
                                Ver como funciona
                           </button>`;
            } else if (isEncerrada) {
                btnHtml = `<button disabled class="bg-gray-200 text-gray-500 px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase cursor-not-allowed">Inscrições Encerradas</button>`;
            } else {
                btnHtml = `<button onclick="window.candidatarVaga('${d.id}')" class="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase shadow hover:bg-blue-700 transition">Enviar Currículo</button>`;
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

// ... (Rest of functions: candidatarVaga, salvarCurriculo, aplicarParaVaga, etc. unchanged) ...
window.candidatarVaga = async (jobId) => {
    if(!auth.currentUser) return alert("Faça login.");
    const cvRef = doc(db, "candidates", auth.currentUser.uid);
    const cvSnap = await getDoc(cvRef);
    if (!cvSnap.exists()) { document.getElementById('cv-setup-modal').classList.remove('hidden'); window.vagaPendenteId = jobId; } else { aplicarParaVaga(jobId); }
};
window.salvarCurriculo = async () => { /* ... (Unchanged) ... */ };
async function aplicarParaVaga(jobId) { /* ... (Unchanged) ... */ }
function listarMinhasVagasEmpresa() { /* ... (Unchanged) ... */ }
window.abrirModalVaga = () => { document.getElementById('job-post-modal').classList.remove('hidden'); };
window.publicarVaga = async () => { /* ... (Unchanged) ... */ };
