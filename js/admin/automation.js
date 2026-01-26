import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, deleteDoc, doc, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ESTADO DO ROBÔ
let roboIntervalo = null;
let roboAtivo = false;
const TEMPO_ENTRE_POSTS = 30 * 60 * 1000; // 30 Minutos

// ============================================================================
// 🧠 CÉREBRO DE DADOS (SUA LISTA COMPLETA)
// ============================================================================
const FAKES = {
    jobs: [
        {t: "Caixa de Supermercado", d: "CLT | R$ 1.320,00 | Enviar Currículo", s: "1.320,00"},
        {t: "Repositor de Mercadorias", d: "CLT | R$ 1.350,00", s: "1.350,00"},
        {t: "Atendente de Loja", d: "CLT | R$ 1.400,00", s: "1.400,00"},
        {t: "Auxiliar de Limpeza", d: "CLT | R$ 1.320,00", s: "1.320,00"},
        {t: "Estoquista", d: "CLT | R$ 1.380,00", s: "1.380,00"},
        {t: "Recepcionista", d: "CLT | R$ 1.500,00", s: "1.500,00"},
        {t: "Vendedor Interno", d: "CLT + Comissão", s: "1.450,00"},
        {t: "Motorista Entregador", d: "CLT | CNH B", s: "1.800,00"},
        {t: "Ajudante de Depósito", d: "CLT | R$ 1.350,00", s: "1.350,00"},
        {t: "Fiscal de Loja", d: "CLT | R$ 1.420,00", s: "1.420,00"}
    ],
    services: [
        {t: "Pintor Residencial", cat: "Obras", p: 120},
        {t: "Encanador", cat: "Obras", p: 80},
        {t: "Eletricista Residencial", cat: "Técnica", p: 100},
        {t: "Diarista", cat: "Limpeza", p: 100},
        {t: "Montador de Móveis", cat: "Obras", p: 150},
        {t: "Técnico de Informática", cat: "Técnica", p: 90},
        {t: "Barman para Eventos", cat: "Outros", p: 150},
        {t: "Pedreiro", cat: "Obras", p: 120},
        {t: "Jardineiro", cat: "Limpeza", p: 100},
        {t: "Instalador de Ventilador", cat: "Técnica", p: 90}
    ],
    missions: [
        {t: "Fotografar Vitrine", d: "Mercado do Bairro.", p: 8},
        {t: "Avaliar Farmácia", d: "Cliente oculto.", p: 5},
        {t: "Preço Gás", d: "Conferir preço no bairro.", p: 6},
        {t: "Fotografar Cardápio", d: "Lanchonete local.", p: 7},
        {t: "Responder Pesquisa", d: "3 perguntas rápidas.", p: 4},
        {t: "Confirmar Horário", d: "Loja de rua.", p: 5},
        {t: "Testar App", d: "Feedback de uso.", p: 12},
        {t: "Foto Ponto Turístico", d: "Praça central.", p: 10},
        {t: "Verificar Fila", d: "Lotérica.", p: 6},
        {t: "Quiz Consumo", d: "Sobre marcas de refri.", p: 4}
    ],
    opps: [
        {t: "Cashback Supermercado", d: "Até 5% de volta.", link: "https://google.com"},
        {t: "Cashback Farmácia", d: "Medicamentos e perfumaria.", link: "https://google.com"},
        {t: "Indique e Ganhe", d: "Ganhe por indicação válida.", link: "https://google.com"},
        {t: "Cupom Delivery", d: "Uso limitado hoje.", link: "https://google.com"},
        {t: "Desconto Exames", d: "Até 20% off em laboratórios.", link: "https://google.com"}
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
                        <h2 class="text-xl font-black text-white italic">🤖 SUPER ROBÔ 3.0</h2>
                        <p class="text-xs text-emerald-400">Posta Empregos, Serviços, Missões e Ofertas aleatoriamente.</p>
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

                <div class="bg-black/20 p-3 rounded text-[10px] text-gray-400 font-mono">
                    <p>⚡ Intervalo: 30 minutos</p>
                    <p>🎲 Conteúdo: Sorteio entre todas as categorias</p>
                    <p>📚 Fonte: Lista Interna + Biblioteca de Links</p>
                </div>
            </div>
            
            <div class="glass-panel p-6 border border-blue-500/50">
                <h2 class="text-xl font-bold text-white mb-2">🔗 LINKS INTELIGENTES</h2>
                <p class="text-xs text-slate-400 mb-6">Cria links curtos e rastreáveis.</p>
                
                <div class="space-y-4 mb-6">
                    <div>
                        <label class="inp-label">NOME CURTO (ID)</label>
                        <input type="text" id="linkName" placeholder="ex: zap_promo" class="inp-editor border-emerald-500/50 text-emerald-400 font-bold">
                    </div>
                    <div>
                        <label class="inp-label">ORIGEM (UTM)</label>
                        <input type="text" id="utmSource" value="instagram" class="inp-editor">
                    </div>
                </div>
                
                <button onclick="window.saveLinkToFirebase()" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg text-xs transition uppercase shadow-lg">
                    💾 GERAR LINK RASTREÁVEL
                </button>
                
                <div id="link-result" class="hidden mt-4 p-4 bg-black/30 rounded border border-emerald-500/30">
                    <p class="text-[10px] text-gray-400 mb-1">Seu Link:</p>
                    <code id="finalLinkDisplay" class="text-white text-xs select-all block break-all font-mono">...</code>
                </div>
            </div>

        </div>

        <div class="glass-panel p-8 mt-6 border border-purple-500/30">
            <h2 class="text-2xl font-black text-white italic mb-2">🏭 GERADOR EM MASSA (MANUAL)</h2>
            <p class="text-sm text-gray-400 mb-8">
                Cria conteúdo simulado instantaneamente.
            </p>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div>
                    <label class="inp-label">TIPO DE DADO</label>
                    <select id="gen-type" class="inp-editor h-10">
                        <option value="jobs">Empregos (Vagas)</option>
                        <option value="services">Serviços (Prestadores)</option>
                        <option value="missions">Micro Tarefas</option>
                        <option value="opps">Oportunidades</option>
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
    console.log("✅ Módulo Automação Carregado.");
}

// ============================================================================
// 2. FUNÇÕES DO ROBÔ (ATUALIZADO PARA POSTAR TUDO)
// ============================================================================

window.toggleRobo = (ligar) => {
    const statusText = document.getElementById('robo-status-text');
    if (ligar) {
        if (roboAtivo) return;
        roboAtivo = true;
        if(statusText) { statusText.innerText = "TRABALHANDO 🚀"; statusText.className = "text-emerald-400 font-black text-lg animate-pulse"; }
        executarCicloRobo();
        roboIntervalo = setInterval(executarCicloRobo, TEMPO_ENTRE_POSTS);
        alert("🤖 ROBÔ INICIADO!\nEle vai postar Vagas, Serviços e Tarefas aleatoriamente.");
    } else {
        roboAtivo = false;
        clearInterval(roboIntervalo);
        if(statusText) { statusText.innerText = "PARADO 🛑"; statusText.className = "text-red-500 font-black text-lg"; }
        alert("Robô pausado.");
    }
};

async function ejecutarCicloRobo() {
    if (!roboAtivo) return;
    console.log("🤖 ROBÔ: Iniciando sorteio...");
    const db = window.db;

    // 1. SORTEIA O TIPO DE POST
    const tipos = ['jobs', 'services', 'missions', 'opps'];
    const tipoSorteado = tipos[Math.floor(Math.random() * tipos.length)];
    
    // 2. SORTEIA O ITEM DA LISTA
    const lista = FAKES[tipoSorteado];
    const modelo = lista[Math.floor(Math.random() * lista.length)];

    console.log(`🎲 Robô Sorteou: ${tipoSorteado.toUpperCase()} -> ${modelo.t}`);

    try {
        let collectionName = "";
        let data = {
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
            is_demo: true,
            visibility_score: 100, // Dá destaque automático
            origem: "robo_auto"
        };

        if(tipoSorteado === 'jobs') {
            collectionName = "jobs";
            data.titulo = modelo.t;
            data.descricao = modelo.d;
            data.salario = modelo.s;
            data.empresa = "Empresa Parceira (Bot)";
            data.status = "ativo";
        } 
        else if(tipoSorteado === 'services') {
            collectionName = "active_providers";
            data.nome_profissional = modelo.t;
            data.bio = "Profissional verificado (Bot).";
            data.services = [{category: modelo.cat, price: modelo.p}];
            data.is_online = true; 
            data.status = "aprovado";
        }
        else if(tipoSorteado === 'missions') {
            collectionName = "missoes";
            data.titulo = modelo.t;
            data.descricao = modelo.d;
            data.valor = modelo.p;
            data.status = "disponivel";
        }
        else if(tipoSorteado === 'opps') {
            collectionName = "oportunidades";
            data.titulo = modelo.t;
            data.descricao = modelo.d;
            data.link = modelo.link;
            data.tipo = "alerta";
        }

        await addDoc(collection(db, collectionName), data);
        
        console.log(`✅ ROBÔ: Postado com sucesso!`);
        document.title = "Atlivio Admin (POSTOU!)";
        setTimeout(() => document.title = "Atlivio Admin", 5000);

    } catch (e) { console.error("❌ ROBÔ FALHOU:", e); }
}
window.executarCicloRobo = ejecutarCicloRobo;

// ============================================================================
// 3. LINKS INTELIGENTES
// ============================================================================

window.saveLinkToFirebase = async () => {
    const nome = document.getElementById('linkName').value;
    const origem = document.getElementById('utmSource').value;
    if(!nome) return alert("Defina um nome curto para o link.");
    
    const db = window.db;
    const btn = document.querySelector('button[onclick="window.saveLinkToFirebase()"]');
    if(btn) btn.innerText = "GERANDO...";

    try {
        const finalLink = `https://rede-atlivio.github.io/.com/?ref=${nome}&utm_source=${origem}`;
        await addDoc(collection(db, "smart_links"), {
            short: nome,
            destination: finalLink,
            original_source: origem,
            clicks: 0,
            created_at: serverTimestamp()
        });
        
        document.getElementById('link-result').classList.remove('hidden');
        document.getElementById('finalLinkDisplay').innerText = finalLink;
        alert("✅ Link gerado com sucesso!");
    } catch(e) { 
        alert("Erro: " + e.message); 
    } finally {
        if(btn) btn.innerText = "💾 GERAR LINK RASTREÁVEL";
    }
};

// ============================================================================
// 4. GERADOR EM MASSA (MANUAL)
// ============================================================================

window.runMassGenerator = async () => {
    const tipo = document.getElementById('gen-type').value;
    const qtd = parseInt(document.getElementById('gen-qty').value);
    const db = window.db;
    
    if(!confirm(`⚠️ Confirmar criação de ${qtd} itens simulados em '${tipo.toUpperCase()}'?\nEles serão marcados como DEMO (is_demo: true).`)) return;

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
            let data = {
                created_at: serverTimestamp(),
                updated_at: serverTimestamp(),
                is_demo: true,
                visibility_score: 10
            };

            const lista = FAKES[tipo] || [];
            const modelo = lista[Math.floor(Math.random() * lista.length)];

            if(tipo === 'jobs') {
                data.titulo = modelo.t;
                data.descricao = modelo.d;
                data.salario = modelo.s;
                data.empresa = "Empresa Parceira (Demo)";
                data.status = "ativo";
            } 
            else if(tipo === 'services') {
                data.nome_profissional = modelo.t + " (Exemplo)";
                data.bio = "Profissional verificado.";
                data.services = [{category: modelo.cat, price: modelo.p}];
                data.is_online = true; 
                data.status = "aprovado";
            }
            else if(tipo === 'missions') {
                data.titulo = modelo.t;
                data.descricao = modelo.d;
                data.valor = modelo.p;
                data.status = "disponivel";
            }
            else if(tipo === 'opps') {
                data.titulo = modelo.t;
                data.descricao = modelo.d;
                data.link = modelo.link;
                data.tipo = "alerta";
            }

            batch.set(docRef, data);
        }

        await batch.commit();
        alert(`✅ ${qtd} itens criados com sucesso em ${tipo.toUpperCase()}!`);
        if(window.forceRefresh) window.forceRefresh();

    } catch (e) {
        console.error(e);
        alert("Erro ao gerar: " + e.message);
    } finally {
        btn.innerHTML = txtOriginal;
        btn.disabled = false;
    }
};
