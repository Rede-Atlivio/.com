import { db, auth, storage } from '../config.js';
import { collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp, where, doc, getDoc, updateDoc, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// ============================================================================
// 1. ROTEADOR DE INTERFACE
// ============================================================================
export function carregarInterfaceEmpregos() {
    console.log("💼 Módulo Vagas: Modo WhatsApp Ativo");
    const containerVagas = document.getElementById('lista-vagas');
    const containerEmpresa = document.getElementById('painel-empresa');
    const userProfile = window.userProfile || {}; 

    if(containerVagas) containerVagas.classList.add('hidden');
    if(containerEmpresa) containerEmpresa.classList.add('hidden');

    if(!document.getElementById('modal-candidatos-empresa')) criarModalCandidatos();

    if (!auth.currentUser) {
        if(containerVagas) {
            containerVagas.innerHTML = `<div class="text-center py-10"><p class="text-gray-400 text-xs">Faça login para ver vagas.</p></div>`;
            containerVagas.classList.remove('hidden');
        }
        return;
    }

    if (userProfile.is_provider) {
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

    // 🛰️ BUSCA O PREÇO ATUAL DO CANDIDATO NO ADMIN
    const configSnap = await getDoc(doc(db, "configuracoes", "global"));
    const precoCandidato = configSnap.data()?.price_jobs_user || 10;
    container.innerHTML = `<div class="text-center py-10"><div class="loader mx-auto mb-2"></div></div>`;

    try {
        // Busca vagas ativas ou ativos para não dar erro de digitação
        const q = query(collection(db, "jobs"), where("status", "in", ["ativa", "ativo"]), orderBy("created_at", "desc"), limit(20));
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
                   // 🧠 LÓGICA DE BOTÃO DINÂMICO
            // Usamos a variável 'cobrancaAtiva' que buscamos no início da função
            let htmlBotao = "";
            
            if (window.billing_jobs_user_status === true) {
                // MODO PAGO: Mostra o Cadeado e o Preço
                htmlBotao = `
                    <button onclick="window.candidatarVaga('${d.id}', '${titulo}', '${job.owner_id}')" class="w-full bg-slate-900 text-amber-400 py-2 rounded-lg text-[10px] font-black uppercase border border-amber-400/30 flex items-center justify-center gap-2 shadow-lg hover:bg-slate-800 transition">
                        🔓 ENVIAR PROPOSTA (${precoCandidato} ATLIX)
                    </button>`;
            } else {
                // MODO GRÁTIS: Mostra o Botão Azul Normal
                htmlBotao = `
                    <button onclick="window.candidatarVaga('${d.id}', '${titulo}', '${job.owner_id}')" class="w-full bg-blue-600 text-white py-2 rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-2 shadow-lg hover:bg-blue-700 transition">
                        🚀 ENVIAR PROPOSTA (GRÁTIS)
                    </button>`;
            }

            // Agora injetamos o botão escolhido no HTML do card
            vagaCard.innerHTML += htmlBotao;
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
            let statusColor = "text-gray-400";
            let statusText = "Enviado";

            if (app.status === 'visto') { statusColor = "text-blue-500"; statusText = "Visualizado"; }
            if (app.status === 'contato') { statusColor = "text-green-500"; statusText = "Em Contato"; }

            container.innerHTML += `
                <div class="bg-white p-4 rounded-xl border border-gray-200 mb-2 shadow-sm">
                    <div class="flex justify-between items-center mb-1">
                        <p class="font-bold text-xs text-blue-900">${app.vaga_titulo}</p>
                        <span class="text-[9px] font-bold uppercase ${statusColor}">${statusText}</span>
                    </div>
                    <p class="text-[9px] text-gray-400 mb-2">Enviado em: ${app.created_at?.toDate().toLocaleDateString()}</p>
                    <button onclick="window.desistirVaga('${d.id}')" class="mt-2 w-full text-[9px] text-red-400 border border-red-100 py-1 rounded hover:bg-red-50">Cancelar Candidatura</button>
                </div>`;
        });
    } catch (e) { console.error(e); }
}

// ============================================================================
// 3. EMPRESA (PAINEL DE SELEÇÃO)
// ============================================================================
export async function publicarVaga() {
    const title = document.getElementById('job-title').value;
    const salary = document.getElementById('job-salary').value;
    const desc = document.getElementById('job-desc').value;

    if(!title || !desc) return alert("Preencha título e descrição.");

    const btn = document.getElementById('btn-pub-job');
    btn.innerText = "⏳ PUBLICANDO..."; btn.disabled = true;

    try {
        const nomeEmpresa = auth.currentUser.displayName || "Empresa Confidencial";
        await addDoc(collection(db, "jobs"), {
            owner_id: auth.currentUser.uid,
            title: title, titulo: title, 
            salary: salary, description: desc,   
            empresa: nomeEmpresa,
            created_at: serverTimestamp(),
            status: 'ativa', is_demo: false
        });

        alert("✅ Vaga publicada com sucesso!");
        document.getElementById('job-post-modal').classList.add('hidden');
        document.getElementById('job-title').value = "";
        document.getElementById('job-desc').value = "";
        listarMinhasVagasEmpresa();

    } catch(e) { 
        alert("Erro: " + e.message); 
    } finally { 
        btn.innerText = "PUBLICAR AGORA"; btn.disabled = false; 
    }
}

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
                    <button onclick="window.verCandidatosEmpresa('${d.id}', '${titulo}')" class="flex-1 bg-blue-600 text-white text-[10px] font-bold py-2 rounded-lg shadow hover:bg-blue-500 flex items-center justify-center gap-2">📄 VER CANDIDATOS</button>
                    ${isAtiva ? `<button onclick="window.encerrarVaga('${d.id}')" class="px-3 bg-red-50 text-red-500 font-bold border border-red-100 rounded-lg text-[10px]">⛔</button>` : ''}
                </div>
            </div>`;
    });
}

// 🔥 LISTA DE CANDIDATOS COM BOTÃO DE WHATSAPP 🔥
export async function verCandidatosEmpresa(jobId, jobTitle) {
    const modal = document.getElementById('modal-candidatos-empresa');
    const lista = document.getElementById('lista-candidatos-ul');
    const titulo = document.getElementById('modal-job-title');
    
    titulo.innerText = jobTitle;
    lista.innerHTML = `<div class="text-center py-6"><div class="loader mx-auto"></div></div>`;
    modal.classList.remove('hidden'); modal.classList.add('flex');

    try {
        // 🛰️ SINCRONIA TOTAL: Busca Preço e Status da Chave no Banco
        const configGlobal = await getDoc(doc(db, "configuracoes", "global"));
        const configData = configGlobal.data();
        window.price_jobs_company_cache = configData?.price_jobs_company || 5;
        window.billing_jobs_company_status = configData?.billing_jobs_company;

        const q = query(collection(db, "job_applications"), where("job_id", "==", jobId));
        const snap = await getDocs(q);

        lista.innerHTML = "";
        if(snap.empty) { lista.innerHTML = `<p class="text-center text-gray-400 text-xs py-4">Ninguém se candidatou ainda.</p>`; return; }

        snap.forEach(d => {
            const cand = d.data();
            
            // 🛡️ MOTOR DE DECISÃO: COBRAR OU LIBERAR?
            const cobrancaAtiva = window.billing_jobs_company_status !== false; 
            const jaPago = cand.contato_liberado === true; 
            let areaContato = "";

            if (!cobrancaAtiva || jaPago) {
                // MODO LIBERADO: Mostra os dados direto
                const linkCv = cand.resume_url || cand.cv_url;
                const btnCv = linkCv ? `<a href="${linkCv}" target="_blank" class="text-blue-500 underline text-[10px] font-black uppercase">📄 PDF LIBERADO</a>` : "";
                
                let zapLink = "#";
                if (cand.whatsapp) {
                    const cleanPhone = cand.whatsapp.replace(/\D/g, '');
                    const msg = `Olá ${cand.nome}, vi seu currículo na Atlivio.`;
                    zapLink = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(msg)}`;
                }

                areaContato = `
                    <div class="flex flex-col gap-2 mt-2">
                        ${btnCv}
                        <a href="${zapLink}" target="_blank" onclick="window.marcarContato('${d.id}')" class="bg-green-500 text-white w-full py-2 rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-2 shadow-sm">📱 CHAMAR NO WHATSAPP</a>
                    </div>
                `;
            } else {
                // MODO PEDÁGIO: Mostra o botão de cobrança
                const precoEmpresa = window.price_jobs_company_cache; 
                areaContato = `
                    <button onclick="window.comprarContato('${d.id}', ${precoEmpresa})" class="mt-2 w-full bg-slate-900 text-amber-400 py-2 rounded-lg text-[10px] font-black uppercase border border-amber-400/30 flex items-center justify-center gap-2">
                        🔓 LIBERAR CONTATO (${precoEmpresa} ATLIX)
                    </button>
                `;
            }

            lista.innerHTML += `
                <div class="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-2">
                    <div class="flex justify-between items-start mb-1">
                        <div>
                            <p class="font-bold text-xs text-slate-800">${cand.nome || 'Candidato'}</p>
                            <p class="text-[9px] text-slate-500 italic">"${cand.mensagem || ''}"</p>
                        </div>
                    </div>
                    ${areaContato}
                </div>`;
        });
    } catch(e) { console.error("Erro ao carregar candidatos:", e); lista.innerHTML = "Erro ao carregar."; }
}

// Atualiza status quando clica no Zap
export async function marcarContato(appId) {
    try { await updateDoc(doc(db, "job_applications", appId), { status: 'contato' }); } catch(e){}
}

// ============================================================================
// 4. CANDIDATURA (AGORA SALVA O ZAP)
// ============================================================================
export function candidatarVaga(id, title, ownerId) {
    if(!auth.currentUser) return alert("Faça login.");
    const modal = document.getElementById('modal-apply');
    document.getElementById('apply-job-title').innerText = title;
    
    // Limpa inputs
    document.getElementById('apply-message').value = "";
    document.getElementById('apply-file').value = "";

    const btnEnviar = document.getElementById('btn-submit-proposal');
    const newBtn = btnEnviar.cloneNode(true);
    btnEnviar.parentNode.replaceChild(newBtn, btnEnviar);
    
    modal.classList.remove('hidden'); modal.classList.add('flex'); 

    newBtn.addEventListener('click', async () => {
        const msg = document.getElementById('apply-message').value;
        const fileInput = document.getElementById('apply-file');

        // 🛰️ [SINCRONIA TOTAL] Busca as regras reais do Admin antes de prosseguir
        const configSnap = await getDoc(doc(db, "configuracoes", "global"));
        const config = configSnap.data();
        
        // Criamos as variáveis mestre que o robô disse que estavam faltando
        const cobrancaAtiva = config.billing_jobs_user === true;
        const custoVaga = config.price_jobs_user || 10; // Preço dinâmico

        // 🛡️ PERGUNTA DE SEGURANÇA (Agora com custoVaga definido)
        if (cobrancaAtiva) {
            if (!confirm(`Deseja usar ${custoVaga} ATLIX para enviar sua proposta para a vaga: ${title}?`)) {
                return; // Se cancelar, o código para aqui
            }
        }

        newBtn.innerText = "COBRANDO TAXA... 🪙"; newBtn.disabled = true;

        // ... (resto do seu código de upload e addDoc normal daqui para baixo)
        
        if (fileInput.files.length === 0) return alert("⚠️ Anexe seu currículo em PDF.");
        const file = fileInput.files[0];
        if (file.type !== "application/pdf") return alert("❌ Apenas arquivos .PDF são permitidos!");

        // 🛡️ PERGUNTA DE SEGURANÇA (IGUAL AO MODO CLIENTE)
            if (!confirm(`Deseja usar ${custoVaga} ATLIX para enviar sua proposta para a vaga: ${title}?`)) {
                return; // Se cancelar, o código para aqui
            }

            newBtn.innerText = "COBRANDO TAXA... 🪙"; newBtn.disabled = true;

        try {
          // 🛡️ MOTOR DE COBRANÇA ESTRATÉGICA (CANDIDATO)
            const configSnap = await getDoc(doc(db, "configuracoes", "global"));
            const config = configSnap.data();
            const cobrancaAtiva = config.billing_jobs_user === true;
            const custoVaga = config.price_jobs_user || 10;

            if (cobrancaAtiva) {
                newBtn.innerText = "VALIDANDO SALDO...";
                const pagamento = await window.pagarComAtlix(custoVaga, "💼 CANDIDATURA_VAGA", `Vaga: ${title}`);
                
                if (!pagamento.success) {
                    alert(`❌ SALDO INSUFICIENTE\n\nVocê precisa de ${custoVaga} ATLIX para se candidatar.\n\nSiga as instruções na aba GANHAR para obter créditos.`);
                    newBtn.innerText = "ENVIAR PROPOSTA 🚀"; newBtn.disabled = false;
                    return; 
                }
                console.log("✅ Pagamento de candidatura processado!");
            }

            // Pega o Zap para salvar na candidatura
            const userSnap = await getDoc(doc(db, "usuarios", auth.currentUser.uid));
            const userZap = userSnap.data()?.whatsapp || userSnap.data()?.phone || "";

            // PASSO 2: Upload PDF (O código segue normal daqui)
            const storageRef = ref(storage, `curriculos/${auth.currentUser.uid}/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            // PASSO 3: Salva Candidatura COM O ZAP
            await addDoc(collection(db, "job_applications"), {
                job_id: id, vaga_titulo: title, owner_id: ownerId,
                user_id: auth.currentUser.uid, 
                nome: auth.currentUser.displayName || "Candidato",
                whatsapp: userZap, // <--- SALVANDO O ZAP AQUI
                message: msg, 
                resume_url: downloadURL,
                created_at: serverTimestamp(), 
                status: 'novo'
            });

            alert("✅ Candidatura enviada! A empresa entrará em contato.");
            fecharModalCandidatura();

        } catch(e) { 
            console.error(e);
            alert("Erro: " + e.message); 
        } finally { 
            newBtn.innerText = "ENVIAR PROPOSTA 🚀"; newBtn.disabled = false; 
        }
    });
}

// UTILITÁRIOS
function criarModalCandidatos() {
    const div = document.createElement('div');
    div.id = "modal-candidatos-empresa";
    div.className = "fixed inset-0 z-50 bg-black/80 backdrop-blur-sm hidden items-center justify-center p-4";
    div.innerHTML = `
        <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div class="bg-slate-900 p-4 flex justify-between items-center"><h3 class="text-white font-bold text-sm uppercase flex items-center gap-2">📄 Candidatos: <span id="modal-job-title" class="text-blue-400">...</span></h3><button onclick="document.getElementById('modal-candidatos-empresa').classList.add('hidden'); document.getElementById('modal-candidatos-empresa').classList.remove('flex')" class="text-gray-400 hover:text-white">✕</button></div>
            <div id="lista-candidatos-ul" class="p-4 overflow-y-auto custom-scrollbar flex-1 bg-white"></div>
        </div>`;
    document.body.appendChild(div);
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

export function desistirVaga(appId) {
    if(!confirm("Desistir?")) return;
    deleteDoc(doc(db, "job_applications", appId)).then(() => listarMinhasCandidaturas());
}

// 🔥 FUNÇÃO DE PEDÁGIO DO EMPREGADOR
async function comprarContato(applicationId, custo) {
    // 🛡️ Garante que o custo seja um número válido
    const valorCobrado = custo || window.price_jobs_company_cache || 5;
    
    if (!confirm(`Deseja usar ${valorCobrado} ATLIX para liberar os dados deste candidato?`)) return;

    try {
        // 🛡️ INTEGRAÇÃO FINANCEIRA ATLIVIO (EMPRESA)
        const configSnap = await getDoc(doc(db, "configuracoes", "global"));
        const custoEmpresa = configSnap.data()?.price_jobs_company || 5;
        
        const pagamento = await window.pagarComAtlix(custoEmpresa, "🔓 LIBERAÇÃO_CONTATO", `Candidato: ${applicationId}`);
        
        if (pagamento.success) {
            const appRef = doc(db, "job_applications", applicationId);
            await updateDoc(appRef, { contato_liberado: true });
            alert("✅ Contato liberado com sucesso!");
            const appSnap = await getDoc(appRef);
            window.verCandidatosEmpresa(appSnap.data().job_id, appSnap.data().vaga_titulo);
        }
    } catch (e) { alert("❌ Erro: " + e.message); }
}

// EXPORTAÇÕES GLOBAIS
window.carregarInterfaceEmpregos = carregarInterfaceEmpregos;
window.carregarVagas = carregarVagas;
window.publicarVaga = publicarVaga;
window.listarMinhasVagasEmpresa = listarMinhasVagasEmpresa;
window.candidatarVaga = candidatarVaga;
window.verCandidatosEmpresa = verCandidatosEmpresa;
window.marcarContato = marcarContato; // <--- NOVA FUNÇÃO
window.fecharModalCandidatura = fecharModalCandidatura;
window.encerrarVaga = encerrarVaga;
window.desistirVaga = desistirVaga;
window.listarMinhasCandidaturas = listarMinhasCandidaturas;
window.abrirModalVaga = () => document.getElementById('job-post-modal').classList.remove('hidden');
window.comprarContato = comprarContato;
