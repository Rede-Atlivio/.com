import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, deleteDoc, doc, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ESTADO DO ROBÔ
let roboIntervalo = null;
let roboAtivo = false;
const TEMPO_ENTRE_POSTS = 30 * 60 * 1000; // 30 Minutos

// ============================================================================
// 1. INICIALIZAÇÃO (RENDERIZA O HTML NA TELA)
// ============================================================================
export async function init() {
    const container = document.getElementById('view-automation');
    
    container.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade">
            
            <div class="glass-panel p-6 border border-emerald-500/50 bg-emerald-900/10">
                <div class="flex justify-between items-center mb-4">
                    <div>
                        <h2 class="text-xl font-black text-white italic">🤖 ROBÔ DE OFERTAS</h2>
                        <p class="text-xs text-emerald-400">Posta itens da biblioteca abaixo a cada 30min.</p>
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

                <h3 class="text-sm font-bold text-white mb-2">📚 Biblioteca de Conteúdo (Afiliado)</h3>
                <div class="bg-slate-900/50 p-4 rounded-xl border border-white/5 mb-4">
                    <input type="text" id="camp-titulo" placeholder="Título (Ex: iPhone 13 Promo)" class="inp-editor mb-2">
                    <input type="text" id="camp-link" placeholder="Seu Link de Afiliado" class="inp-editor text-blue-300 mb-2">
                    <input type="text" id="camp-desc" placeholder="Descrição curta..." class="inp-editor mb-2">
                    <div class="flex gap-2">
                        <select id="camp-tipo" class="inp-editor w-32">
                            <option value="alerta">🔴 Alerta</option>
                            <option value="cashback">🟢 Cashback</option>
                        </select>
                        <button onclick="window.adicionarCampanha()" class="bg-blue-600 text-white px-4 rounded-lg font-bold text-xs uppercase hover:bg-blue-500 flex-1">+ Adicionar</button>
                    </div>
                </div>

                <p class="text-[10px] text-gray-400 uppercase font-bold mb-2">Itens na Fila:</p>
                <div id="lista-campanhas" class="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    <p class="text-center text-gray-500 text-xs py-4">Carregando lista...</p>
                </div>
            </div>
            
            <div class="glass-panel p-6 border border-blue-500/50">
                <h2 class="text-xl font-bold text-white mb-2">🔗 LINKS INTELIGENTES</h2>
                <p class="text-xs text-slate-400 mb-6">Cria links curtos e rastreáveis para campanhas.</p>
                
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
                <span class="text-yellow-500 font-bold">⚠️ ATENÇÃO:</span> Os itens aparecem na aba "DEMONSTRATIVO".
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

    // Carrega a lista do robô
    listarCampanhasAtivas();
    console.log("✅ Módulo Automação Carregado.");
}

// ============================================================================
// 2. FUNÇÕES DO ROBÔ
// ============================================================================

window.toggleRobo = (ligar) => {
    const statusText = document.getElementById('robo-status-text');
    if (ligar) {
        if (roboAtivo) return;
        
        // Verifica munição
        const db = window.db;
        getDocs(collection(db, "bot_library")).then(snap => {
            if(snap.empty) {
                alert("⚠️ Adicione pelo menos 1 link na lista antes de ligar o robô!");
                return;
            }
            roboAtivo = true;
            if(statusText) { statusText.innerText = "TRABALHANDO 🚀"; statusText.className = "text-emerald-400 font-black text-lg animate-pulse"; }
            
            // Executa o primeiro ciclo imediatamente
            executarCicloRobo();
            
            // Inicia o intervalo
            roboIntervalo = setInterval(executarCicloRobo, TEMPO_ENTRE_POSTS);
            alert("🤖 ROBÔ INICIADO!\nEle usará sua lista de links cadastrados.");
        });
    } else {
        roboAtivo = false;
        clearInterval(roboIntervalo);
        if(statusText) { statusText.innerText = "PARADO 🛑"; statusText.className = "text-red-500 font-black text-lg"; }
        alert("Robô pausado.");
    }
};

async function ejecutarCicloRobo() {
    if (!roboAtivo) return;
    console.log("🤖 ROBÔ: Ciclo iniciado...");
    const db = window.db;

    try {
        const snap = await getDocs(collection(db, "bot_library"));
        if(snap.empty) {
            console.log("❌ Robô parou: Biblioteca vazia.");
            window.toggleRobo(false);
            return;
        }
        const opcoes = snap.docs.map(d => d.data());
        const oferta = opcoes[Math.floor(Math.random() * opcoes.length)];
        
        await addDoc(collection(db, "oportunidades"), {
            titulo: oferta.titulo,
            descricao: oferta.descricao,
            tipo: oferta.tipo,
            link: oferta.link,
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
            is_demo: false, 
            visibility_score: 100,
            origem: "robo_auto"
        });
        
        console.log(`✅ ROBÔ: Postou "${oferta.titulo}"!`);
        document.title = "Atlivio Admin (POSTOU!)";
        setTimeout(() => document.title = "Atlivio Admin", 5000);
    } catch (e) { console.error("❌ ROBÔ FALHOU:", e); }
}
// Expõe ciclo para console
window.executarCicloRobo = ejecutarCicloRobo;

window.adicionarCampanha = async () => {
    const titulo = document.getElementById('camp-titulo').value;
    const link = document.getElementById('camp-link').value;
    const desc = document.getElementById('camp-desc').value;
    const tipo = document.getElementById('camp-tipo').value;

    if(!titulo || !link) return alert("Preencha Título e Link.");
    const db = window.db;

    try {
        await addDoc(collection(db, "bot_library"), {
            titulo: titulo,
            link: link,
            descricao: desc || "Oferta imperdível.",
            tipo: tipo,
            created_at: serverTimestamp()
        });
        
        // Limpa form
        document.getElementById('camp-titulo').value = "";
        document.getElementById('camp-link').value = "";
        document.getElementById('camp-desc').value = "";
        
        alert("✅ Link salvo na biblioteca do Robô!");
        listarCampanhasAtivas();
    } catch(e) { alert("Erro: " + e.message); }
};

window.removerCampanha = async (id) => {
    if(!confirm("Remover este item da lista do robô?")) return;
    const db = window.db;
    await deleteDoc(doc(db, "bot_library", id));
    listarCampanhasAtivas();
};

async function listarCampanhasAtivas() {
    const lista = document.getElementById('lista-campanhas');
    if(!lista) return;
    const db = window.db;

    const q = query(collection(db, "bot_library"), orderBy("created_at", "desc"));
    const snap = await getDocs(q);

    lista.innerHTML = "";
    if(snap.empty) {
        lista.innerHTML = `<p class="text-center text-gray-500 text-xs py-4">Nenhum link cadastrado. O robô não vai funcionar.</p>`;
        return;
    }

    snap.forEach(d => {
        const item = d.data();
        lista.innerHTML += `
            <div class="flex justify-between items-center bg-slate-900/50 p-2 rounded border border-white/5">
                <div class="truncate pr-2">
                    <p class="text-xs text-white font-bold">${item.titulo}</p>
                    <p class="text-[9px] text-blue-400 truncate">${item.link}</p>
                </div>
                <button onclick="window.removerCampanha('${d.id}')" class="text-red-500 hover:text-red-400 font-bold px-2">🗑️</button>
            </div>
        `;
    });
}
// Expõe para ser chamado no init
window.listarCampanhasAtivas = listarCampanhasAtivas;

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

    // LISTA DE DADOS SIMULADOS (RECUPERADA DA SUA MENSAGEM)
    const fakes = {
        jobs: [
            {t: "Caixa de Supermercado", d: "CLT | R$ 1.320,00 | Enviar Currículo", s: "1.320,00"},
            {t: "Repositor de Mercadorias", d: "CLT | R$ 1.350,00", s: "1.350,00"},
            {t: "Atendente de Loja", d: "CLT | R$ 1.400,00", s: "1.400,00"},
            {t: "Auxiliar de Limpeza", d: "CLT | R$ 1.320,00", s: "1.320,00"},
            {t: "Estoquista", d: "CLT | R$ 1.380,00", s: "1.380,00"},
            {t: "Recepcionista", d: "CLT | R$ 1.500,00", s: "1.500,00"},
            {t: "Vendedor Interno", d: "CLT + Comissão", s: "1.450,00"},
            {t: "Motorista Entregador", d: "CLT | CNH B", s: "1.800,00"}
        ],
        services: [
            {t: "Pintor Residencial", cat: "Obras", p: 120},
            {t: "Encanador", cat: "Obras", p: 80},
            {t: "Eletricista Residencial", cat: "Técnica", p: 100},
            {t: "Diarista", cat: "Limpeza", p: 100},
            {t: "Montador de Móveis", cat: "Obras", p: 150},
            {t: "Técnico de Informática", cat: "Técnica", p: 90},
            {t: "Barman para Eventos", cat: "Outros", p: 150},
            {t: "Jardineiro", cat: "Limpeza", p: 100}
        ],
        missions: [
            {t: "Fotografar Fachada", d: "Tirar foto da loja X.", p: 8},
            {t: "Avaliar Atendimento", d: "Cliente oculto em farmácia.", p: 5},
            {t: "Conferir Preço Gás", d: "Verificar preço no bairro.", p: 6},
            {t: "Fotografar Cardápio", d: "Lanchonete local.", p: 7},
            {t: "Responder Pesquisa", d: "3 perguntas rápidas.", p: 4},
            {t: "Testar App Parceiro", d: "Enviar feedback.", p: 12},
            {t: "Verificar Fila", d: "Banco ou lotérica.", p: 6}
        ],
        opps: [
            {t: "Cashback Supermercado", d: "Até 5% de volta.", link: "https://..."},
            {t: "Cashback Farmácia", d: "Medicamentos e perfumaria.", link: "https://..."},
            {t: "Indique e Ganhe", d: "Ganhe por indicação válida.", link: "https://..."},
            {t: "Cupom Delivery", d: "Uso limitado hoje.", link: "https://..."},
            {t: "Desconto Exames", d: "Até 20% off em laboratórios.", link: "https://..."}
        ]
    };

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
                visibility_score: 10 // Score baixo para ficar no fundo
            };

            const lista = fakes[tipo] || [];
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
                data.bio = "Profissional verificado pela plataforma.";
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
        // Se houver função global de refresh, chama ela
        if(window.forceRefresh) window.forceRefresh();

    } catch (e) {
        console.error(e);
        alert("Erro ao gerar: " + e.message);
    } finally {
        btn.innerHTML = txtOriginal;
        btn.disabled = false;
    }
};
