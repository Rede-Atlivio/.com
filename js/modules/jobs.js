import { db, auth, storage } from '../app.js';
import { userProfile } from '../auth.js';
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, getDoc, doc, setDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// GATILHO DE ABA
const tabEmpregos = document.getElementById('tab-empregos');
if(tabEmpregos) {
    tabEmpregos.addEventListener('click', () => { carregarInterfaceEmpregos(); });
}

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
        if(containerEmpresa) {
            containerEmpresa.classList.remove('hidden');
            listarMinhasVagasEmpresa();
        }
    }
}

function listarVagasParaCandidato(container) {
    container.innerHTML = `<div class="text-center py-6"><div class="loader mx-auto mb-2 border-blue-200 border-t-blue-600"></div></div>`;

    const q = query(collection(db, "jobs"), orderBy("created_at", "desc"));

    onSnapshot(q, (snap) => {
        container.innerHTML = "";
        
        if (snap.empty) {
            container.innerHTML = `<div class="text-center py-10 bg-white rounded-xl border border-gray-100"><p class="text-xs font-bold text-gray-500">Nenhuma vaga aberta.</p></div>`;
            return;
        }

        snap.forEach(d => {
            const vaga = d.data();
            const isSeed = vaga.is_seed === true;

            // PROTEÇÃO DE MARCA
            const badge = isSeed 
                ? `<span class="bg-yellow-50 text-yellow-700 text-[8px] font-bold px-2 py-1 rounded uppercase border border-yellow-100">Exemplo</span>` 
                : `<span class="bg-blue-50 text-blue-700 text-[8px] font-bold px-2 py-1 rounded uppercase">Nova</span>`;
            
            const btnText = isSeed ? "Receber Alerta" : "Enviar Currículo";
            const btnAction = isSeed 
                ? `onclick="alert('🔔 LISTA DE ESPERA\\n\\nEsta é uma vaga de exemplo. Ao clicar aqui, você sinaliza interesse em vagas reais de ${vaga.titulo} que serão abertas em breve!')"`
                : `onclick="window.candidatarVaga('${d.id}')"`;

            container.innerHTML += `
                <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-3 animate-fadeIn">
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="font-black text-blue-900 text-sm uppercase">${vaga.titulo}</h3>
                        ${badge}
                    </div>
                    <p class="text-[10px] text-gray-500 mb-2 line-clamp-2">${vaga.descricao}</p>
                    <div class="flex justify-between items-center mt-3 border-t border-gray-50 pt-2">
                        <span class="text-[9px] font-bold text-green-600">${vaga.salario || 'A combinar'}</span>
                        <button ${btnAction} class="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase shadow hover:bg-blue-700 transition">
                            ${btnText}
                        </button>
                    </div>
                </div>`;
        });
    });
}

// ... (MANTENHA O RESTANTE DO CÓDIGO DE CANDIDATURA E EMPRESA IGUAL AO ANTERIOR) ...
// (Para economizar espaço, não vou repetir as funções de upload de PDF e criar vaga real, pois elas não mudaram, apenas a LISTAGEM acima mudou).
window.candidatarVaga = async (jobId) => { /* ... código anterior ... */ };
window.salvarCurriculo = async () => { /* ... código anterior ... */ };
function listarMinhasVagasEmpresa() { /* ... código anterior ... */ };
window.abrirModalVaga = () => { document.getElementById('job-post-modal').classList.remove('hidden'); };
window.publicarVaga = async () => { /* ... código anterior ... */ };
window.verCandidatos = async (id) => { /* ... código anterior ... */ };
