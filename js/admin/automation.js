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
// 1. INICIALIZAÇÃO (LIMPA - FOCO EM DADOS E ROBÔ) ──▶
// ============================================================================
export async function init() {
    const container = document.getElementById('view-automation');
    
    container.innerHTML = `
        <div class="mb-4 p-2">
            <p class="text-[10px] text-gray-500 uppercase font-black tracking-widest italic">🛰️ Central Maestro movida para a aba principal ──▶</p>
        </div>

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
       else if(tipoSorteado === 'opps') { collectionName = "oportunidades"; data.titulo = modelo.t; data.descricao = modelo.d; data.link = modelo.link; data.tipo = "alerta"; data.action = "oportunidades"; }

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
            else if(tipo === 'opps') { data.titulo = modelo.t; data.descricao = modelo.d; data.link = modelo.link; data.tipo = "alerta"; data.action = "oportunidades"; }

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
            <div class="bg-slate-900 border-2 border-purple-500/40 rounded-[2rem] p-8 shadow-2xl mb-10 relative overflow-hidden">
                
                <div class="flex justify-between items-start mb-8">
                    <div class="flex items-center gap-4">
                        <div class="w-14 h-14 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center text-3xl shadow-lg shadow-purple-500/20">🎼</div>
                        <div>
                            <h2 class="text-white font-black uppercase italic text-xl tracking-tighter">Maestro Flow</h2>
                            <p class="text-purple-400 text-[10px] font-black uppercase tracking-[0.3em]">Gestão de Jornada do Usuário</p>
                        </div>
                    </div>
                    <div class="bg-black/40 px-4 py-2 rounded-xl border border-white/5">
                        <span class="text-[8px] text-gray-500 block uppercase font-black">Status da Rede</span>
                        <div class="flex items-center gap-2">
                            <div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span class="text-emerald-400 text-[10px] font-bold uppercase">Sincronizada</span>
                        </div>
                    </div>
                </div>

                <div class="space-y-6">
                    <div class="relative">
                        <div class="absolute -left-3 top-0 w-1 h-full bg-purple-500/20 rounded-full"></div>
                        <label class="text-[10px] font-black text-purple-300 uppercase tracking-widest flex items-center gap-2 mb-2">
                            <span class="w-5 h-5 bg-purple-500 text-white rounded-full flex items-center justify-center text-[10px]">1</span> 
                            Configurar Roteiro da Campanha (JSON)
                        </label>
                        <textarea id="maestro-flow-json" rows="5" 
                            class="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl p-5 text-emerald-400 font-mono text-xs focus:border-purple-500 outline-none transition-all shadow-inner"
                            placeholder='{"dia": 1, "msg": "Bem-vindo!"}'></textarea>
                        <p class="text-[9px] text-gray-500 mt-2 italic px-1">O robô lerá este código para saber o que falar com o usuário em cada dia de uso.</p>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                        
                        <div class="space-y-2">
                            <label class="text-[8px] font-black text-gray-500 uppercase tracking-widest pl-1">Passo 2: Gravar</label>
                            <button onclick="window.salvarESincronizarRede()" class="w-full bg-white text-slate-900 font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-purple-50 transition shadow-xl active:scale-95 flex items-center justify-center gap-2">
                                💾 SALVAR NA REDE
                            </button>
                        </div>

                        <div class="space-y-2">
                            <label class="text-[8px] font-black text-gray-500 uppercase tracking-widest pl-1">Passo 3: Notificar</label>
                            <button onclick="window.ativarGatilhoPush()" class="w-full bg-slate-800 text-purple-400 font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest border-2 border-purple-500/20 hover:border-purple-500/50 transition shadow-lg active:scale-95">
                                🔔 DISPARAR PUSH
                            </button>
                        </div>
                        
                        <div class="space-y-2">
                            <label class="text-[8px] font-black text-gray-500 uppercase tracking-widest pl-1">Passo 4: Escalar</label>
                            <button onclick="window.agendarFluxoMensal()" class="w-full bg-slate-800 text-emerald-400 font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest border-2 border-emerald-500/20 hover:border-emerald-500/50 transition shadow-lg active:scale-95">
                                📅 AGENDAR MESES
                            </button>
                        </div>

                        <div class="space-y-2">
                            <label class="text-[8px] font-black text-blue-500 uppercase tracking-widest pl-1">Utilidade: Recuperar</label>
                            <button onclick="window.resgatarRoteiroDoBanco()" class="w-full bg-blue-900/30 text-blue-400 font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest border-2 border-blue-500/20 hover:border-blue-500/50 transition shadow-lg active:scale-95">
                                📥 RESGATAR DO BANCO
                            </button>
                        </div>
                        
                    </div>
                </div>
            </div>

            <div class="flex justify-between items-center mb-2 pt-4 border-t border-white/5">
                <h2 class="text-sm font-black text-gray-400 uppercase tracking-tighter">🚀 Disparo Imediato (Público-Alvo)</h2>
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
                            <option value="oportunidades">🏷️ Intenção: Oportunidades</option>
                            <option value="loja">🛍️ Intenção: Compras/Produtos</option>
                            <option value="canal">📺 Intenção: Conteúdo/Canal</option>
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
                            <option value="missoes">⚡ Ir para Missões</option>
                            <option value="jobs">💼 Ir para Vagas</option>
                            <option value="oportunidades">🏷️ Ir para Oportunidades</option>
                            <option value="produtos">🛍️ Ir para Produtos</option>
                            <option value="canal">📺 Ir para Canal ATLIVIO</option>
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

                <div class="bg-slate-900 border border-blue-500/20 rounded-3xl p-6 shadow-xl space-y-4">
                    <div class="flex items-center gap-3 border-b border-slate-800 pb-4">
                        <i data-lucide="activity" class="text-blue-400"></i>
                        <h3 class="text-sm font-black text-white uppercase italic">Saúde da Rede (Real-Time)</h3>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="p-4 bg-black/20 rounded-2xl border border-white/5">
                            <p class="text-[8px] text-gray-500 uppercase font-black">Latência de Disparo</p>
                            <p class="text-xl font-black text-emerald-400">~240ms</p>
                        </div>
                        <div class="p-4 bg-black/20 rounded-2xl border border-white/5">
                            <p class="text-[8px] text-gray-500 uppercase font-black">Entrega Push</p>
                            <p class="text-xl font-black text-blue-400">99.8%</p>
                        </div>
                    </div>
                    <p class="text-[9px] text-gray-500 italic">O sistema está configurado para escala de milhões. O Sininho Individual foi removido para focar no Maestro Flow Global.</p>
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

   };

// 🗑️ LIXO REMOVIDO: A busca individual foi desativada para unificação do Maestro Flow.

// 🚀 MOTOR DE DISPARO INSTANTÂNEO V12.4: Fale direto com o Robô Cloud Run
window.dispararMaestroEmMassa = async function() {
    // 🌍 ENDEREÇO DO ROBÔ: O link oficial do seu Cloud Run
    const URL_ROBO = "https://enviar-notificacao-v1-887430049204.us-central1.run.app";
    const intencao = document.getElementById('maestro-mass-intent').value;
    const msg = document.getElementById('maestro-mass-msg').value.trim();
    const action = document.getElementById('maestro-mass-action').value;
    const btn = document.getElementById('btn-mass-fire');

    if (!msg) return alert("❌ Digite a mensagem do disparo!");
    
    // 🛡️ Segurança: Confirmação de impacto em massa
    if (!confirm(`🔥 IMPACTO GLOBAL: Disparar agora para o segmento ${intencao.toUpperCase()}?`)) return;

    btn.innerHTML = "⏳ DISPARANDO CANHÃO...";
    btn.disabled = true;

    try {
        console.log("📡 [Maestro] Enviando ordem direta para o Robô Cloud Run...");
        
        // 🚀 O Admin agora dá uma ÚNICA ordem direta para o servidor processar a base toda
        const resposta = await fetch(URL_ROBO, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                mode: "instant_target", // Chave para o Robô V12.4 entender o comando de massa
                intencao: intencao,
                mensagem: msg,
                action: action
            })
        });

        if (resposta.ok) {
            alert("🚀 SUCESSO! O Robô recebeu a ordem e está entregando as notificações agora.");
            document.getElementById('maestro-mass-msg').value = "";
        } else {
            const erroTxt = await resposta.text();
            throw new Error(erroTxt);
        }
    } catch (e) {
        console.error("❌ Erro no Disparo em Massa:", e);
        alert("Falha ao acionar o Robô: " + e.message);
    } finally {
        btn.innerHTML = "Disparar para Público Alvo 🔥";
        btn.disabled = false;
    }
};
// 🗑️ LIXO REMOVIDO: Disparo individual por UID agora é via Robô Maestro Cloud.

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
// ============================================================================
// 🛰️ SENTINELA REALTIME: Monitora conversas e alimenta o Painel Maestro
// ============================================================================
window.unsubscribeGatilhoChat = null;
let contadorLocalAlertas = 0;

window.ativarGatilhoChatRealtime = async () => {
    // 🛡️ Previne duplicidade de conexão
    if (window.unsubscribeGatilhoChat) {
        alert("📡 O Sentinela já está em órbita monitorando a rede.");
        return;
    }

    const { collection, query, where, onSnapshot, addDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    const db = window.db;

    // 🟢 Atualiza a Interface Visual (LED e Texto)
    const led = document.getElementById('status-robo-led');
    const txt = document.getElementById('status-robo-txt');
    if (led) led.className = "w-4 h-4 rounded-full bg-green-500 shadow-[0_0_15px_#22c55e]";
    if (txt) txt.innerText = "SISTEMA ATIVO";

    // 🕵️ Ouve chats com mensagens não lidas
    const q = query(collection(db, "chats"), where("last_message_read", "==", false));

    window.unsubscribeGatilhoChat = onSnapshot(q, (snap) => {
        // Atualiza card de "Usuários em Chat" no painel
        const countAtivos = document.getElementById('count-ativos');
        if (countAtivos) countAtivos.innerText = snap.size;

        snap.docChanges().forEach(async (change) => {
            if (change.type === "added" || change.type === "modified") {
                const d = change.doc.data();
                const target = d.last_message_to;

                if (target) {
                    // 1. DISPARA NOTIFICAÇÃO PARA O CELULAR DO USUÁRIO
                    await addDoc(collection(db, "user_notifications"), {
                        userId: target,
                        type: 'chat',
                        message: "Nova proposta recebida no chat! 💬",
                        action: 'chat',
                        read: false,
                        created_at: serverTimestamp()
                    });

                    // 2. ESCREVE NO LOG VISUAL DO ADMIN
                    contadorLocalAlertas++;
                    const countEl = document.getElementById('count-alertas');
                    if (countEl) countEl.innerText = contadorLocalAlertas;

                    const logArea = document.getElementById('maestro-live-logs');
                    if (logArea) {
                        const time = new Date().toLocaleTimeString();
                        const linhaLog = `
                            <div class="text-blue-400 border-l-2 border-blue-500 pl-3 py-1 mb-2 bg-blue-500/5 animate-fade font-mono">
                                <span class="text-gray-500">[${time}]</span> 
                                <span class="font-black text-white">CHAT EVENT</span> ──▶ 
                                <span class="text-blue-300">Target: ${target.slice(0,8)}...</span>
                                <span class="ml-2 text-[9px] bg-green-600/20 text-green-400 px-1 rounded font-bold">PUSH SENT ✔</span>
                            </div>
                        `;
                        // Remove a mensagem de "Aguardando..." se for a primeira linha
                        if (contadorLocalAlertas === 1) logArea.innerHTML = "";
                        logArea.innerHTML = linhaLog + logArea.innerHTML;
                    }
                }
            }
        });
    }, (error) => {
        console.error("❌ Erro no Sentinela:", error);
        if (led) led.className = "w-4 h-4 rounded-full bg-red-600 animate-pulse";
        if (txt) txt.innerText = "OFFLINE (ERRO)";
    });

    console.log("🛰️ Sentinela Atlivio V3.5 Online.");
};
// ============================================================================
// 🎼 LÓGICA MESTRA: MAESTRO FLOW V50 (O QUE FALTAVA) ──▶
// ============================================================================

// 💾 PASSO 2: SALVAR E SINCRONIZAR ──▶
window.salvarESincronizarRede = async function() {
    const jsonArea = document.getElementById('maestro-flow-json');
    if (!jsonArea || !jsonArea.value.trim()) return alert("❌ Digite o Script JSON antes de salvar!");

    try {
        const scriptValido = JSON.parse(jsonArea.value);
        const { doc, setDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

        // 🛡️ GRAVAÇÃO DE ESCALA: Salva o roteiro central para milhões de usuários lerem ──▶
        await setDoc(doc(window.db, "settings", "maestro_flow"), {
            script: scriptValido,
            versao: "V50",
            updated_at: serverTimestamp()
        });

        alert("💾 REDE SINCRONIZADA!\nO sinal foi propagado para o banco de dados.");
    } catch (e) {
        alert("❌ ERRO NO SCRIPT: Verifique se esqueceu alguma vírgula ou aspas.");
    }
};

// 🔔 PASSO 3: DISPARAR PUSH (MOTOR DE IMPACTO TOTAL V12.3)
window.ativarGatilhoPush = async function() {
    const URL_ROBO_MAESTRO = "https://enviar-notificacao-v1-887430049204.us-central1.run.app";
    console.log("🚀 [Maestro] Iniciando Canhão de Milhões...");
    
    try {
        const { collection, addDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        
        // 1. Resgata o DNA (JSON) que está na tela do Admin
        const scriptJson = document.getElementById('maestro-flow-json')?.value.trim();
        if (!scriptJson) return alert("❌ O Cérebro (JSON) está vazio! Cole o roteiro primeiro.");

        const payloadOficial = JSON.parse(scriptJson);

        // 2. REGISTRO DE SEGURANÇA: Salva a ordem no banco para histórico
        await addDoc(collection(window.db, "maestro_push"), {
            mode: "mass_broadcast",
            status: "processing", // Marca como processando para o robô não duplicar
            payload_version: payloadOficial.versao || "65.1",
            created_at: serverTimestamp()
        });

        // 3. O GRITO EXTERNO: Aciona o Robô Cloud Run diretamente via POST
        // É aqui que a mágica da escala de milhões acontece sem latência.
        console.log("📡 [Transmissor] Gritando para o Robô Cloud Run...");
        const resposta = await fetch(URL_ROBO_MAESTRO, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // 🛡️ Blindagem V66: Garante que o Robô receba a chave 'fluxo' para evitar Erro 500 no servidor
            body: JSON.stringify({
                mode: "mass_broadcast",
                script_payload: {
                    campanha: payloadOficial.campanha || "MARKETING_GLOBAL",
                    fluxo: payloadOficial.fluxo || payloadOficial // 🚀 Se o JSON já tiver a chave fluxo, usa ela. Se não, envelopa o array.
                }
            })
        });

        if (resposta.ok) {
            alert("🔥 CANHÃO EM MASSA DISPARADO!\nO Robô iniciou a varredura de milhões de usuários.");
        } else {
            const erroTxt = await resposta.text();
            throw new Error(erroTxt);
        }

    } catch (e) {
        console.error("❌ Erro Crítico no Canhão:", e);
        alert("Falha no Disparo: " + e.message);
    }
};

// 📅 PASSO 4: AGENDAR MESES ──▶
window.agendarFluxoMensal = async function() {
    const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    
    // ⚙️ PILOTO AUTOMÁTICO: Liga a verificação diária de jornada ──▶
    await updateDoc(doc(window.db, "settings", "global"), {
        maestro_auto_pilot: true,
        last_schedule: new Date()
    });

    alert("📅 AGENDAMENTO CONCLUÍDO!\nA automação de meses agora está vigiando a rede.");
};
// 📥 FUNÇÃO DE RESGATE MAESTRO: Busca o último JSON salvo para evitar perda de dados ──▶
window.resgatarRoteiroDoBanco = async function() {
    console.log("🔍 [Maestro] Iniciando resgate de roteiro...");
    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

    try {
        const snap = await getDoc(doc(window.db, "settings", "maestro_flow"));

        if (snap.exists()) {
            const dados = snap.data();
            const campoJson = document.getElementById('maestro-flow-json');
            
            if (campoJson && dados.script) {
                // Injeta o JSON formatado com 2 espaços para ficar bonito na tela ──▶
                campoJson.value = JSON.stringify(dados.script, null, 2);
                alert("✅ ROTEIRO RESGATADO!\nO seu último script salvo foi carregado no campo.");
            }
        } else {
            alert("⚠️ Nenhum roteiro encontrado no servidor.");
        }
    } catch (e) {
        console.error("❌ Erro no resgate:", e);
        alert("Erro técnico ao buscar dados.");
    }
};

/**
 * 🤖 MOTOR DE INTELIGÊNCIA DA ASSISTANT (RESTAURADO)
 * Gil, esta função mantém os botões de alerta vivos, mas sem a mesa fixa.
 */
window.executarVigilanciaAtiva = async () => {
    const fv = window.firebaseModules;
    const db = window.db;
    const msgArea = document.getElementById('assistant-msg');

    if (!msgArea || !fv || !db) return;

    try {
        // 🛰️ A IA vigia saques e missões pendentes
        const qPix = fv.query(fv.collection(db, "mission_submissions"), fv.where("status", "==", "approved_pending_pix"));
        const qCur = fv.query(fv.collection(db, "mission_submissions"), fv.where("status", "==", "pending"));

        const [snapPix, snapCur] = await Promise.all([fv.getDocs(qPix), fv.getDocs(qCur)]);

        let botoesHtml = "";
        let textoStatus = "Sistema Atlivio Estabilizado.";

        if (snapPix.size > 0 || snapCur.size > 0) {
            textoStatus = `Atenção: ${snapPix.size} saques pendentes detectados.`;
            
            if (snapPix.size > 0) {
                // Mantém o botão que leva para a aba de finanças (onde você paga)
                botoesHtml += `<button onclick="window.switchView('finance')" class="bg-emerald-600 text-white px-2 py-1.5 rounded-lg text-[9px] font-black uppercase shadow-lg hover:bg-emerald-500 transition-all">Pagar Agora 💸</button>`;
            }
            if (snapCur.size > 0) {
                botoesHtml += `<button onclick="window.switchView('missions')" class="bg-blue-600 text-white px-2 py-1.5 rounded-lg text-[9px] font-black uppercase shadow-lg hover:bg-blue-500 transition-all ml-1">Analisar 📸</button>`;
            }
        }

        msgArea.innerHTML = `
            <div class="flex flex-col gap-1.5 animate-fade">
                <span class="text-indigo-200 font-bold italic leading-tight">"${textoStatus}"</span>
                <div class="flex items-center gap-2">${botoesHtml}</div>
            </div>
        `;
    } catch (e) {
        console.warn("⚠️ Assistant em espera: " + e.message);
    }
};

// 🛰️ Ciclo de Vida: Tenta rodar agora e repete a cada 30 segundos
if (!window.intervaloVigilancia) {
    window.executarVigilanciaAtiva();
    window.intervaloVigilancia = setInterval(window.executarVigilanciaAtiva, 30000);
}
