import { db, auth, storage } from '../app.js'; // Importando Storage
import { userProfile } from '../auth.js';
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, getDoc, doc, setDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

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
    
    const cvRef = doc(db, "candidates", auth.currentUser.uid);
    const cvSnap = await getDoc(cvRef);

    if (!cvSnap.exists()) {
        document.getElementById('cv-setup-modal').classList.remove('hidden');
        window.vagaPendenteId = jobId; 
    } else {
        aplicarParaVaga(jobId);
    }
};

window.salvarCurriculo = async () => {
    const nome = document.getElementById('cv-nome').value;
    const habilidades = document.getElementById('cv-habilidades').value;
    const telefone = document.getElementById('cv-telefone').value;
    const fileInput = document.getElementById('cv-arquivo');

    if(!nome || !telefone) return alert("Preencha nome e telefone.");

    const btn = document.getElementById('btn-save-cv');
    btn.innerText = "Salvando...";
    btn.disabled = true;

    try {
        let pdfUrl = null;

        // Upload do PDF (Se existir)
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            // Verifica tamanho (ex: max 5MB)
            if (file.size > 5 * 1024 * 1024) throw new Error("PDF muito grande (Max 5MB).");
            
            const storageRef = ref(storage, `curriculos/${auth.currentUser.uid}/${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            pdfUrl = await getDownloadURL(snapshot.ref);
        }

        // Salva dados no Firestore
        await setDoc(doc(db, "candidates", auth.currentUser.uid), {
            nome_completo: nome,
            habilidades: habilidades,
            telefone: telefone,
            curriculo_pdf: pdfUrl, // Link do PDF
            updated_at: serverTimestamp()
        }, { merge: true });
        
        alert("✅ Currículo Salvo!");
        document.getElementById('cv-setup-modal').classList.add('hidden');
        
        if (window.vagaPendenteId) {
            aplicarParaVaga(window.vagaPendenteId);
            window.vagaPendenteId = null;
        }
    } catch (e) {
        alert("Erro: " + e.message);
    } finally {
        btn.innerText = "SALVAR E CONTINUAR";
        btn.disabled = false;
    }
};

async function aplicarParaVaga(jobId) {
    try {
        // Busca dados do candidato para "congelar" na aplicação
        const cvDoc = await getDoc(doc(db, "candidates", auth.currentUser.uid));
        const cvData = cvDoc.data();

        await addDoc(collection(db, "job_applications"), {
            job_id: jobId,
            candidate_id: auth.currentUser.uid,
            candidate_name: cvData.nome_completo,
            candidate_pdf: cvData.curriculo_pdf || null, // Salva link na aplicação
            applied_at: serverTimestamp(),
            status: "pending"
        });
        
        // Atualiza contador da vaga (opcional, mas bom pra UX)
        // await updateDoc(doc(db, "jobs", jobId), { candidatos_count: increment(1) });

        alert("🚀 Candidatura enviada com sucesso!");
    } catch(e) {
        alert("Erro ao aplicar: " + e.message);
    }
}

// --- 3. VISÃO EMPRESA (Postar e Gerenciar) ---
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
                <div class="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-2">
                    <div class="flex justify-between items-center mb-2">
                        <div>
                            <p class="font-bold text-xs text-gray-800">${v.titulo}</p>
                            <p class="text-[9px] text-gray-500">Publicado em: ${v.created_at ? v.created_at.toDate().toLocaleDateString() : 'Hoje'}</p>
                        </div>
                        <button onclick="window.verCandidatos('${d.id}')" class="bg-blue-100 text-blue-700 text-[9px] font-bold uppercase px-3 py-1.5 rounded hover:bg-blue-200 transition">
                            Ver Candidatos
                        </button>
                    </div>
                    <div id="candidatos-${d.id}" class="hidden mt-2 border-t border-gray-200 pt-2 space-y-1">
                        <p class="text-[9px] text-gray-400 italic">Carregando candidatos...</p>
                    </div>
                </div>`;
        });
    });
}

// Função para expandir e ver candidatos (COM PDF)
window.verCandidatos = async (jobId) => {
    const container = document.getElementById(`candidatos-${jobId}`);
    if(container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        
        // Busca aplicações desta vaga
        const q = query(collection(db, "job_applications"), where("job_id", "==", jobId));
        const snap = await getDocs(q);
        
        container.innerHTML = "";
        if (snap.empty) {
            container.innerHTML = `<p class="text-[9px] text-gray-400">Nenhum candidato ainda.</p>`;
        } else {
            snap.forEach(appDoc => {
                const app = appDoc.data();
                const pdfLink = app.candidate_pdf 
                    ? `<a href="${app.candidate_pdf}" target="_blank" class="text-red-500 font-bold hover:underline">📄 PDF</a>` 
                    : `<span class="text-gray-300">Sem PDF</span>`;

                container.innerHTML += `
                    <div class="flex justify-between items-center bg-white p-2 rounded border border-gray-100">
                        <span class="text-[10px] font-bold text-gray-700">${app.candidate_name}</span>
                        <div class="flex gap-2 text-[9px]">
                            ${pdfLink}
                            <button onclick="alert('Funcionalidade Premium: Contato liberado no plano empresa!')" class="text-blue-600 font-bold hover:text-blue-800">📞 Contato</button>
                        </div>
                    </div>
                `;
            });
        }
    } else {
        container.classList.add('hidden');
    }
};

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
            tipo: "CLT",
            created_at: serverTimestamp(),
            candidatos_count: 0
        });
        
        alert("✅ Vaga Publicada!");
        document.getElementById('job-post-modal').classList.add('hidden');
    } catch(e) {
        alert("Erro: " + e.message);
    } finally {
        btn.innerText = "PUBLICAR AGORA";
        btn.disabled = false;
    }
};
