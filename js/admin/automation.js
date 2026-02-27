import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, deleteDoc, doc, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ESTADO DO ROBÔ
let roboIntervalo = null;
let roboAtivo = false;
const TEMPO_ENTRE_POSTS = 30 * 60 * 1000; // 30 Minutos

// ============================================================================
// 🧠 CÉREBRO DE DADOS (SUA LISTA ATUALIZADA - JANEIRO 2026)
// ============================================================================
export const FAKES = {
    missions: [
        {t: "Tirar foto de vitrine de mercado", d: "Micro Tarefa Local", p: 8.00},
        {t: "Avaliar atendimento de farmácia", d: "Cliente Oculto", p: 5.00},
        {t: "Conferir preço de gás de cozinha", d: "Pesquisa de Preço no Bairro", p: 6.00},
        {t: "Fotografar cardápio de lanchonete", d: "Digitalização de Cardápio", p: 7.00},
        {t: "Responder pesquisa rápida", d: "3 Perguntas sobre consumo", p: 4.00},
        {t: "Confirmar horário de funcionamento", d: "Ir até a loja física", p: 5.00},
        {t: "Enviar foto de ponto turístico", d: "Turismo Local", p: 10.00},
        {t: "Testar aplicativo parceiro", d: "Enviar feedback de uso", p: 12.00},
        {t: "Fotografar fachada de salão", d: "Atualização de Mapas", p: 6.00},
        {t: "Conferir produto em mercado", d: "Disponibilidade de Estoque", p: 8.00},
        {t: "Avaliar transporte por app", d: "Experiência do Usuário", p: 5.00},
        {t: "Registrar preço de combustível", d: "Monitoramento de Preços", p: 7.00},
        {t: "Foto de promoção em mercado", d: "Caçador de Ofertas", p: 9.00},
        {t: "Verificar fila em lotérica", d: "Tempo de espera", p: 6.00},
        {t: "Responder quiz rápido", d: "Sobre marcas de refri", p: 4.00}
    ],
    jobs: [
        {t: "Caixa de Supermercado", d: "CLT | Enviar Currículo", s: "1.320,00"},
        {t: "Repositor de Mercadorias", d: "CLT | Enviar Currículo", s: "1.350,00"},
        {t: "Atendente de Loja", d: "CLT | Enviar Currículo", s: "1.400,00"},
        {t: "Auxiliar de Limpeza", d: "CLT | Enviar Currículo", s: "1.320,00"},
        {t: "Estoquista", d: "CLT | Enviar Currículo", s: "1.380,00"},
        {t: "Recepcionista", d: "CLT | Enviar Currículo", s: "1.500,00"},
        {t: "Operador de Caixa (Tarde)", d: "CLT | Enviar Currículo", s: "1.320,00"},
        {t: "Vendedor Interno", d: "CLT + Comissão", s: "1.450,00"},
        {t: "Auxiliar Administrativo", d: "CLT | Enviar Currículo", s: "1.600,00"},
        {t: "Atendente de SAC", d: "Home Office", s: "1.500,00"},
        {t: "Motorista Entregador", d: "CLT | CNH A/B", s: "1.800,00"},
        {t: "Ajudante de Depósito", d: "CLT | Enviar Currículo", s: "1.350,00"},
        {t: "Fiscal de Loja", d: "CLT | Enviar Currículo", s: "1.420,00"}
    ],
    opps: [
        {t: "Cashback em Supermercados", d: "Até 5% de volta nas compras", link: "https://atlivio.com/test"},
        {t: "Cashback em Eletrônicos", d: "Compras online selecionadas", link: "https://atlivio.com/test"},
        {t: "Cashback em Farmácias", d: "Medicamentos e perfumaria", link: "https://atlivio.com/test"},
        {t: "Indique App de Entregas", d: "Ganhe por indicação válida", link: "https://atlivio.com/test"},
        {t: "Conta Digital Bônus", d: "Bônus por cadastro aprovado", link: "https://atlivio.com/test"},
        {t: "Cupom Delivery", d: "Uso limitado hoje", link: "https://atlivio.com/test"},
        {t: "Promoção Fast Food", d: "Relâmpago: Válido hoje", link: "https://atlivio.com/test"},
        {t: "Desconto Laboratorial", d: "Até 20% off em exames", link: "https://atlivio.com/test"},
        {t: "Internet Residencial", d: "Oferta especial planos", link: "https://atlivio.com/test"}
    ],
    services: [
        {t: "Pintor Residencial", cat: "Obras", p: 120},
        {t: "Encanador", cat: "Obras", p: 80},
        {t: "Eletricista Residencial", cat: "Técnica", p: 100},
        {t: "Diarista", cat: "Limpeza", p: 100},
        {t: "Montador de Móveis", cat: "Obras", p: 150},
        {t: "Técnico de Informática", cat: "Técnica", p: 90},
        {t: "Barman para Eventos", cat: "Festas", p: 150},
        {t: "Pedreiro", cat: "Obras", p: 120},
        {t: "Jardineiro", cat: "Serviços Gerais", p: 100},
        {t: "Instalador de Ventilador", cat: "Técnica", p: 90}
    ]
};

// ============================================================================
// 1. INICIALIZAÇÃO
// ============================================================================
export async function init() {
    const container = document.getElementById('view-automation');
    
    container.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade">
            
            <div class="glass-panel p-6 border border-emerald-500/50 bg-emerald-900/10">
                <div class="flex justify-between items-center mb-4">
                    <div>
                        <h2 class="text-xl font-black text-white italic">🤖 ROBÔ DE OFERTAS 2026</h2>
                        <p class="text-xs text-emerald-400">Posta Empregos, Serviços, Missões e Ofertas.</p>
                    </div>
                    <div class="text-right">
                        <p class="text-[10px] text-gray-400 uppercase font-bold mb-1">Status</p>
                        <div id="robo-status-text" class="text-red-500 font-black text-lg">PARADO 🛑</div>
                    </div>
                </div>
                
                <div class="flex gap-4 mb-6">
                    <button onclick="window.toggleRobo(true)" class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold text-xs uppercase shadow-lg transition transform active:scale-95">
                        ▶️ LIGAR ROBÔ
                    </button>
                    <button onclick="window.toggleRobo(false)" class="flex-1 bg-red-900/50 hover:bg-red-900 text-white py-3 rounded-xl font-bold text-xs uppercase border border-red-800 transition">
                        ⏸️ PAUSAR
                    </button>
                </div>
            </div>
            
            <div class="glass-panel p-6 border border-blue-500/50">
                <h2 class="text-xl font-bold text-white mb-2">🔗 LINKS INTELIGENTES</h2>
                <div class="space-y-4 mb-4">
                    <input type="text" id="linkName" placeholder="Nome Curto (ex: zap_promo)" class="inp-editor border-emerald-500/50 text-emerald-400 font-bold">
                    <input type="text" id="utmSource" value="instagram" class="inp-editor">
                </div>
                <button onclick="window.saveLinkToFirebase()" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg text-xs transition uppercase shadow-lg">
                    💾 GERAR LINK
                </button>
                <div id="link-result" class="hidden mt-4 p-4 bg-black/30 rounded"><code id="finalLinkDisplay" class="text-white text-xs select-all block break-all font-mono">...</code></div>
            </div>
        </div>

        <div class="glass-panel p-8 mt-6 border border-purple-500/30">
            <h2 class="text-2xl font-black text-white italic mb-2">🏭 GERADOR EM MASSA</h2>
            <p class="text-sm text-gray-400 mb-8">
                Gera dados baseados na lista oficial de Janeiro/2026.
                <span class="text-yellow-500 font-bold">⚠️ ATENÇÃO:</span> Use a aba "DEMONSTRATIVO" para ver.
            </p>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div>
                    <label class="inp-label">TIPO DE DADO</label>
                    <select id="gen-type" class="inp-editor h-10">
                        <option value="jobs">Empregos (Vagas)</option>
                        <option value="services">Serviços (Prestadores)</option>
                        <option value="missions">Micro Tarefas (Missões)</option>
                        <option value="opps">Oportunidades (Cashback)</option>
                    </select>
                </div>
                <div>
                    <label class="inp-label">QUANTIDADE</label>
                    <select id="gen-qty" class="inp-editor h-10">
                        <option value="1">1 Item</option>
                        <option value="3">3 Itens</option>
                        <option value="5">5 Itens</option>
                        <option value="10">10 Itens</option>
                    </select>
                </div>
                <div>
                    <button onclick="window.runMassGenerator()" class="w-full h-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-black rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-xs uppercase">
                        <i data-lucide="zap"></i> GERAR AGORA
                    </button>
                </div>
            </div>
        </div>
    `;
    console.log("✅ Módulo Automação (Lista 2026) Carregado.");
}

// ============================================================================
// 2. FUNÇÕES DO ROBÔ
// ============================================================================
window.toggleRobo = (ligar) => {
    const statusText = document.getElementById('robo-status-text');
    if (ligar) {
        if (roboAtivo) return;
        roboAtivo = true;
        if(statusText) { statusText.innerText = "TRABALHANDO 🚀"; statusText.className = "text-emerald-400 font-black text-lg animate-pulse"; }
        executarCicloRobo();
        roboIntervalo = setInterval(executarCicloRobo, TEMPO_ENTRE_POSTS);
        alert("🤖 ROBÔ INICIADO!\nEle vai postar Tarefas, Vagas e Serviços automaticamente.");
    } else {
        roboAtivo = false;
        clearInterval(roboIntervalo);
        if(statusText) { statusText.innerText = "PARADO 🛑"; statusText.className = "text-red-500 font-black text-lg"; }
        alert("Robô pausado.");
    }
};

async function ejecutarCicloRobo() {
    if (!roboAtivo) return;
    const db = window.db;
    const tipos = ['jobs', 'services', 'missions', 'opps'];
    const tipoSorteado = tipos[Math.floor(Math.random() * tipos.length)];
    const lista = FAKES[tipoSorteado];
    const modelo = lista[Math.floor(Math.random() * lista.length)];

    console.log(`🤖 ROBÔ POSTANDO: ${tipoSorteado.toUpperCase()} -> ${modelo.t}`);

    try {
        let collectionName = "";
        let data = {
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
            is_demo: true,
            visibility_score: 100,
            origem: "robo_auto"
        };

       if(tipoSorteado === 'jobs') { collectionName = "jobs"; data.titulo = modelo.t; data.descricao = modelo.d; data.salario = modelo.s; data.empresa = "Atlivio Jobs"; data.status = "ativo"; } 
        else if(tipoSorteado === 'services') { collectionName = "active_providers"; data.nome_profissional = modelo.t; data.bio = "Profissional Verificado"; data.services = [{category: modelo.cat, price: Number(modelo.p)}]; data.is_online = true; data.status = "aprovado"; data.balance = 0; data.wallet_balance = 0; }
        else if(tipoSorteado === 'missions') { collectionName = "missoes"; data.titulo = modelo.t; data.descricao = modelo.d; data.valor = Number(modelo.p); data.status = "disponivel"; }
        else if(tipoSorteado === 'opps') { collectionName = "oportunidades"; data.titulo = modelo.t; data.descricao = modelo.d; data.link = modelo.link; data.tipo = "alerta"; }

        await addDoc(collection(db, collectionName), data);
        document.title = "Atlivio (NOVO POST!)";
        setTimeout(() => document.title = "Atlivio Admin", 5000);
    } catch (e) { console.error("❌ ROBÔ FALHOU:", e); }
}
window.executarCicloRobo = ejecutarCicloRobo;

// ============================================================================
// 3. GERADOR EM MASSA
// ============================================================================
window.runMassGenerator = async () => {
    const tipo = document.getElementById('gen-type').value;
    const qtd = parseInt(document.getElementById('gen-qty').value);
    const db = window.db;
    
    if(!confirm(`Criar ${qtd} itens simulados em '${tipo}'?`)) return;

    const btn = document.querySelector('button[onclick="window.runMassGenerator()"]');
    const txtOriginal = btn.innerHTML;
    btn.innerHTML = "⏳ GERANDO...";
    btn.disabled = true;

    try {
        const batch = writeBatch(db);
        let collectionName = "";
        if(tipo === 'jobs') collectionName = "jobs";
        else if(tipo === 'services') collectionName = "active_providers";
        else if(tipo === 'missions') collectionName = "missoes";
        else if(tipo === 'opps') collectionName = "oportunidades";

        for (let i = 0; i < qtd; i++) {
            const docRef = doc(collection(db, collectionName));
            const lista = FAKES[tipo] || [];
            const modelo = lista[Math.floor(Math.random() * lista.length)];
            
            let data = { created_at: serverTimestamp(), updated_at: serverTimestamp(), is_demo: true, visibility_score: 10 };

            if(tipo === 'jobs') { data.titulo = modelo.t; data.descricao = modelo.d; data.salario = String(modelo.s); data.empresa = "Atlivio Jobs"; data.status = "ativo"; } 
            else if(tipo === 'services') { data.nome_profissional = modelo.t; data.bio = "Profissional Verificado"; data.services = [{category: modelo.cat, price: Number(modelo.p)}]; data.is_online = true; data.status = "aprovado"; data.balance = 0; }
            else if(tipo === 'missions') { data.titulo = modelo.t; data.descricao = modelo.d; data.valor = modelo.p; data.status = "disponivel"; }
            else if(tipo === 'opps') { data.titulo = modelo.t; data.descricao = modelo.d; data.link = modelo.link; data.tipo = "alerta"; }

            batch.set(docRef, data);
        }
        await batch.commit();
        alert(`✅ ${qtd} itens gerados! Verifique na aba DEMONSTRATIVO.`);
        if(window.forceRefresh) window.forceRefresh();
    } catch (e) { alert("Erro: " + e.message); } finally { btn.innerHTML = txtOriginal; btn.disabled = false; }
};

// ============================================================================
// 4. LINKS
// ============================================================================
window.saveLinkToFirebase = async () => {
    const nome = document.getElementById('linkName').value;
    const origem = document.getElementById('utmSource').value;
    if(!nome) return alert("Defina um nome.");
    try {
        await addDoc(collection(window.db, "smart_links"), {
            short: nome, destination: `https://rede-atlivio.github.io/.com/?ref=${nome}&utm_source=${origem}`,
            original_source: origem, clicks: 0, created_at: serverTimestamp()
        });
        document.getElementById('link-result').classList.remove('hidden');
        document.getElementById('finalLinkDisplay').innerText = `https://rede-atlivio.github.io/.com/?ref=${nome}`;
        alert("✅ Link Criado!");
    } catch(e) { alert("Erro: " + e.message); }
};

// 🚀 MOTOR DE BONIFICAÇÃO POR INATIVIDADE (V38.1 - LIMPO E FUNCIONAL)
window.executarVarreduraDeInativos = async () => {
    console.log("🚀 [MOTOR] Iniciando Varredura de Inativos...");
    const db = window.db;
    const { collection, getDocs, runTransaction, doc, getDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

    try {
        const configRef = doc(db, "settings", "global");
        const configSnap = await getDoc(configRef);
        const config = configSnap.data();

        if (!config) return alert("❌ Erro: Regras não encontradas em settings/global.");

        console.log("📋 Regras lidas do Admin:", { v7: config.bonus_recuperacao_7d, v15: config.bonus_recuperacao_15d });

        const agora = new Date();
        const limite7d = new Date(agora.getTime() - (7 * 24 * 60 * 60 * 1000));
        const limite15d = new Date(agora.getTime() - (15 * 24 * 60 * 60 * 1000));

        const usuariosSnap = await getDocs(collection(db, "usuarios"));
        let contagem = 0;

        for (const userDoc of usuariosSnap.docs) {
            const u = userDoc.data();
            const lastActive = u.last_active?.toDate() || new Date(2000, 0, 1);
            let valorInjecao = 0;
            let tagMotivo = "";

            if (lastActive < limite15d && (config.bonus_recuperacao_15d || 0) > 0) {
                valorInjecao = Number(config.bonus_recuperacao_15d);
                tagMotivo = "🎁 BÔNUS FIDELIDADE 🧡";
            } else if (lastActive < limite7d && (config.bonus_recuperacao_7d || 0) > 0) {
                valorInjecao = Number(config.bonus_recuperacao_7d);
                tagMotivo = "🎁 PRESENTE DE RETORNO 💛";
            }

            const jaRecebeuHoje = u.last_bonus_recovery_at?.toDate() > new Date(agora.getTime() - (24 * 60 * 60 * 1000));

            if (valorInjecao > 0 && !jaRecebeuHoje) {
                await runTransaction(db, async (transaction) => {
                    const uRef = doc(db, "usuarios", userDoc.id);
                    transaction.update(uRef, {
                        wallet_bonus: (u.wallet_bonus || 0) + valorInjecao,
                        last_bonus_recovery_at: serverTimestamp()
                    });
                    const extratoRef = doc(collection(db, "extrato_financeiro"));
                    transaction.set(extratoRef, {
                        uid: userDoc.id, valor: valorInjecao, tipo: tagMotivo,
                        descricao: `Presente de retorno! Sentimos sua falta.`,
                        timestamp: serverTimestamp()
                    });
                });
                contagem++;
                console.log(`✅ BONIFICADO: ${u.nome || userDoc.id} recebeu R$ ${valorInjecao}`);
            }
        }
        alert(`🎯 VARREDURA CONCLUÍDA!\n\n${contagem} usuários inativos foram bonificados.`);
    } catch (e) {
        console.error("❌ Erro técnico no motor:", e);
    }
};
// ============================================================================
// 🎼 MÓDULO MAESTRO: CONTROLE DE EXPERIÊNCIA E FLUXO
// ============================================================================
window.carregarMaestro = async function() {
    const container = document.getElementById('view-maestro');
    if (!container) return;

    container.innerHTML = `
        <div class="max-w-5xl mx-auto space-y-6 animate-fade pb-10">
            <div class="flex justify-between items-center mb-2">
                <h2 class="text-2xl font-black text-white uppercase italic tracking-tighter">🎼 Maestro: Controle de Fluxo</h2>
                <span class="bg-purple-600/20 text-purple-400 text-[10px] font-black px-3 py-1 rounded-full border border-purple-500/30">V29 - MARKETING ESCALÁVEL</span>
            </div>

            <div class="bg-gradient-to-r from-purple-900/50 to-blue-900/50 border border-purple-500/50 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                <div class="absolute right-[-20px] top-[-20px] w-32 h-32 bg-purple-500/20 rounded-full blur-3xl"></div>
                <div class="flex items-center gap-3 border-b border-purple-500/30 pb-4 mb-4 relative z-10">
                    <h3 class="text-sm font-black text-white uppercase tracking-widest">🚀 Disparo em Massa (Público-Alvo)</h3>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10">
                    <div class="md:col-span-1">
                        <label class="block text-[9px] font-black text-purple-300 uppercase mb-1">Filtrar Público</label>
                        <select id="maestro-mass-intent" class="w-full bg-slate-950 border border-purple-500/30 rounded-xl p-3 text-white text-xs outline-none focus:border-purple-400 transition">
                            <option value="todos">🌍 Todos os Usuários</option>
                            <option value="servicos">🛠️ Intenção: Serviços</option>
                            <option value="missoes">⚡ Intenção: Missões</option>
                            <option value="empregos">💼 Intenção: Empregos</option>
                        </select>
                    </div>
                    <div class="md:col-span-3">
                        <label class="block text-[9px] font-black text-purple-300 uppercase mb-1">Mensagem do Guia (Bônus/Oferta)</label>
                        <input type="text" id="maestro-mass-msg" placeholder="Ex: Ganhe R$ 20 agora cumprindo uma missão rápida!" class="w-full bg-slate-950 border border-purple-500/30 rounded-xl p-3 text-white text-xs outline-none focus:border-purple-400 transition">
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 relative z-10">
                    <div>
                        <label class="block text-[9px] font-black text-purple-300 uppercase mb-1">Ação ao Clicar</label>
                        <select id="maestro-mass-action" class="w-full bg-slate-950 border border-purple-500/30 rounded-xl p-3 text-white text-xs font-bold outline-none focus:border-purple-400 transition">
                            <option value="wallet">💰 Ir para Carteira</option>
                            <option value="services">🛠️ Ir para Serviços</option>
                            <option value="chat">💬 Ir para Chat</option>
                        </select>
                    </div>
                    <div class="md:col-span-2 flex items-end">
                        <button onclick="window.dispararMaestroEmMassa()" id="btn-mass-fire" class="w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-3 rounded-xl shadow-lg transition transform active:scale-95 uppercase text-xs tracking-widest flex items-center justify-center gap-2">
                            Disparar para Público Alvo 🔥
                        </button>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                    <div class="flex items-center gap-3 border-b border-slate-800 pb-4">
                        <i data-lucide="megaphone" class="text-blue-500"></i>
                        <h3 class="text-sm font-black text-white uppercase">Sininho: Teste Individual</h3>
                    </div>
                    
                    <div class="relative">
                        <label class="block text-[9px] font-black text-gray-500 uppercase mb-1">Buscar Usuário (Nome, Email, CPF, Tel)</label>
                        <div id="maestro-search-container" class="relative">
                            <input type="text" id="maestro-user-search" placeholder="Digite para buscar..." oninput="window.buscarUsuarioMaestro(this.value)" class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs outline-none focus:border-blue-500 transition pr-10">
                            <i data-lucide="search" class="absolute right-3 top-3 w-4 h-4 text-gray-500"></i>
                        </div>
                        
                        <div id="maestro-search-results" class="absolute z-50 w-full bg-slate-800 border border-slate-700 rounded-xl mt-1 hidden max-h-48 overflow-y-auto custom-scrollbar shadow-2xl"></div>
                        
                        <input type="hidden" id="maestro-uid">
                        
                        <div id="maestro-selected-user" class="hidden mt-2 flex justify-between items-center bg-blue-900/20 border border-blue-800/50 p-3 rounded-xl">
                            <span id="maestro-selected-name" class="text-xs font-bold text-blue-400"></span>
                            <button onclick="window.limparSelecaoMaestro()" class="text-red-400 hover:text-red-300 text-[10px] font-black uppercase tracking-widest px-2 transition">✕ Trocar</button>
                        </div>
                    </div>

                    <div>
                        <label class="block text-[9px] font-black text-gray-500 uppercase mb-1">Mensagem do Teste</label>
                        <textarea id="maestro-msg" rows="2" placeholder="Ex: Aviso direto para teste..." class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs outline-none focus:border-blue-500 transition resize-none"></textarea>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div class="hidden">
                             <input type="hidden" id="maestro-type" value="gift">
                        </div>
                        <div>
                            <label class="block text-[9px] font-black text-gray-500 uppercase mb-1">Ação</label>
                            <select id="maestro-action" class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs font-bold outline-none">
                                <option value="chat">Ir para Chat</option>
                                <option value="wallet">Ir para Carteira</option>
                                <option value="services">Ir para Serviços</option>
                            </select>
                        </div>
                        <div class="flex items-end">
                            <button onclick="window.dispararNotificacaoMaestro()" class="w-full bg-slate-700 hover:bg-blue-600 text-white font-black py-3 rounded-xl transition uppercase text-[10px] tracking-widest">
                                Enviar Teste
                            </button>
                        </div>
                    </div>
                </div>

                <div class="space-y-6">
                    <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                        <div class="flex items-center gap-3 border-b border-slate-800 pb-4 mb-4">
                            <i data-lucide="compass" class="text-emerald-500"></i>
                            <h3 class="text-sm font-black text-white uppercase">Gestor do Tour</h3>
                        </div>
                        <p class="text-[11px] text-gray-400 mb-4">Reseta o onboarding do usuário selecionado no menu do Sininho.</p>
                        <button onclick="window.resetarTourUsuario()" class="w-full bg-slate-800 hover:bg-red-900/30 text-gray-300 hover:text-red-400 border border-slate-700 py-3 rounded-xl font-bold text-xs transition uppercase">
                            Resetar Tour do Usuário 🔄
                        </button>
                    </div>

                    <div class="bg-emerald-600/10 border border-emerald-500/20 rounded-3xl p-6">
                         <h4 class="text-emerald-400 font-black text-[10px] uppercase mb-1">Dica de Conversão</h4>
                         <p class="text-[11px] text-emerald-200/70 leading-relaxed italic">"Envie bônus contextualizados. Para clientes que buscam serviços, ofereça desconto; para prestadores, ofereça cashback de taxa."</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // 🚀 BUSCADOR AUTOMÁTICO DE USUÁRIOS
    setTimeout(async () => {
        try {
            const { collection, getDocs, query, limit } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
            const snap = await getDocs(query(collection(window.db, "usuarios"), limit(3000))); // Limite de segurança de memória
            const selectUID = document.getElementById('maestro-uid');
            
            if(selectUID) {
                selectUID.innerHTML = '<option value="">-- Selecione um usuário --</option>';
                snap.forEach(d => {
                    const u = d.data();
                    const nome = u.nome || u.displayName || u.nome_profissional || 'Desconhecido';
                    selectUID.innerHTML += `<option value="${d.id}">${nome} (${u.email || d.id.substring(0,6)})</option>`;
                });
            }
        } catch(e) { console.error("Erro ao puxar usuários para o select:", e); }
    }, 200);
};

// ============================================================================
// 🚀 MOTOR DE DISPARO EM MASSA DO MAESTRO
// ============================================================================
window.dispararMaestroEmMassa = async function() {
    const intencao = document.getElementById('maestro-mass-intent').value;
    const msg = document.getElementById('maestro-mass-msg').value.trim();
    const action = document.getElementById('maestro-mass-action').value;
    const btn = document.getElementById('btn-mass-fire');

    if (!msg) return alert("❌ Digite a mensagem da oferta/guia!");
    
    let txtPublico = intencao === 'todos' ? 'TODOS OS USUÁRIOS DA PLATAFORMA' : `todos os usuários de: ${intencao.toUpperCase()}`;
    if (!confirm(`🔥 AÇÃO DE MARKETING: Você vai disparar um alerta Push Inteligente para ${txtPublico}!\n\nConfirmar disparo?`)) return;

    btn.innerHTML = "⏳ Enviando Lote...";
    btn.disabled = true;

    try {
        const { collection, getDocs, query, where, writeBatch, doc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const db = window.db;

        // Monta a Query 
        let q;
        if (intencao === 'todos') {
            q = collection(db, "usuarios");
        } else {
            q = query(collection(db, "usuarios"), where("user_intent", "==", intencao));
        }

        const snap = await getDocs(q);
        if (snap.empty) {
            alert("Nenhum usuário ativo neste público alvo.");
            btn.innerHTML = "Disparar para Público Alvo 🔥";
            btn.disabled = false;
            return;
        }

        const batch = writeBatch(db);
        let contador = 0;

        snap.forEach(d => {
            const uid = d.id;
            const refNotif = doc(collection(db, "user_notifications"));
            batch.set(refNotif, {
                userId: uid,
                type: "gift", 
                message: msg,
                action: action,
                read: false,
                created_at: serverTimestamp()
            });
            contador++;
        });

        await batch.commit();

        alert(`✅ MARKETING ENVIADO!\nGuia disparado para ${contador} usuários na hora.`);
        document.getElementById('maestro-mass-msg').value = "";
    } catch (e) {
        console.error("Erro no disparo em massa:", e);
        alert("❌ Erro no disparo: " + e.message);
    } finally {
        btn.innerHTML = "Disparar para Público Alvo 🔥";
        btn.disabled = false;
    }
};

// --- LÓGICA DE DISPARO ---
window.dispararNotificacaoMaestro = async function() {
    const uid = document.getElementById('maestro-uid').value.trim();
    const msg = document.getElementById('maestro-msg').value.trim();
    const type = document.getElementById('maestro-type').value;
    const action = document.getElementById('maestro-action').value;

    if (!uid || !msg) return alert("❌ Preencha o UID e a Mensagem!");

    try {
        const { collection, addDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const db = window.db; // 💎 Usa a instância global já autenticada do Admin

        await addDoc(collection(db, "user_notifications"), {
            userId: uid,
            type: type,
            message: msg,
            action: action,
            read: false,
            created_at: serverTimestamp()
        });

        alert("✅ Guia enviado com sucesso ao usuário!");
        document.getElementById('maestro-msg').value = "";
    } catch (e) {
        console.error(e);
        alert("❌ Erro ao enviar: " + e.message);
    }
};

window.resetarTourUsuario = async function() {
    const uid = document.getElementById('maestro-uid').value.trim();
    if (!uid) return alert("❌ Informe o UID para resetar o Tour!");

    try {
        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const { db } = await import('./config.js');

        // 🧹 LIMPEZA TOTAL: Reseta o estado e a intenção para o Tour reaparecer
        await updateDoc(doc(db, "usuarios", uid), {
            tour_complete: false,
            user_intent: "" 
        });

        alert("✅ Tour e Intenção resetados! O usuário verá a tela de escolha no próximo login.");
    } catch (e) {
        alert("❌ Erro ao resetar: " + e.message);
    }
};
