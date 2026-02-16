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

// 🚀 MOTOR DE BONIFICAÇÃO POR INATIVIDADE (V38.0)
window.executarVarreduraDeInativos = async () => {
    console.log("🚀 [MOTOR] Iniciando Varredura de Inativos (V10 Modular)...");
    const db = window.db;
    const { collection, getDocs, runTransaction, doc, getDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

    try {
        // 1. LEITURA MODULAR DAS REGRAS
        const configRef = doc(db, "settings", "global");
        const configSnap = await getDoc(configRef);
        const config = configSnap.data();

        if (!config) return alert("❌ Erro: Documento settings/global não existe.");

        console.log("📋 Regras lidas:", { v7: config.bonus_recuperacao_7d, v15: config.bonus_recuperacao_15d });

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

            // Prioridade 15 dias
            if (lastActive < limite15d && (config.bonus_recuperacao_15d || 0) > 0) {
                valorInjecao = Number(config.bonus_recuperacao_15d);
                tagMotivo = "RECUPERACAO_15D 🧡";
            } else if (lastActive < limite7d && (config.bonus_recuperacao_7d || 0) > 0) {
                valorInjecao = Number(config.bonus_recuperacao_7d);
                tagMotivo = "RECUPERACAO_7D 💛";
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
        alert(`🎯 VARREDURA CONCLUÍDA!\n\n${contagem} usuários foram bonificados.`);
    } catch (e) {
        console.error("❌ Erro no Motor:", e);
        alert("Falha na varredura. Veja o console.");
    }
};
        const limite7d = new Date(agora.getTime() - (7 * 24 * 60 * 60 * 1000));
        const limite15d = new Date(agora.getTime() - (15 * 24 * 60 * 60 * 1000));

        const usuariosSnap = await getDocs(collection(db, "usuarios"));
        let contagem = 0;

        for (const userDoc of usuariosSnap.docs) {
            const u = userDoc.data();
            const lastActive = u.last_active?.toDate() || new Date(2000,0,1);
            let valorInjecao = 0;
            let tagMotivo = "";

            if (lastActive < limite15d && config.bonus_recuperacao_15d > 0) {
                valorInjecao = config.bonus_recuperacao_15d;
                tagMotivo = "RECUPERACAO_15D 🧡";
            } else if (lastActive < limite7d && config.bonus_recuperacao_7d > 0) {
                valorInjecao = config.bonus_recuperacao_7d;
                tagMotivo = "RECUPERACAO_7D 💛";
            }

            const jaRecebeuHoje = u.last_bonus_recovery_at?.toDate() > new Date(agora.getTime() - (24 * 60 * 60 * 1000));

            if (valorInjecao > 0 && !jaRecebeuHoje) {
                await runTransaction(db, async (transaction) => {
                    transaction.update(userDoc.ref, {
                        wallet_bonus: (u.wallet_bonus || 0) + valorInjecao,
                        last_bonus_recovery_at: serverTimestamp()
                    });
                    const extratoRef = doc(collection(db, "extrato_financeiro"));
                    transaction.set(extratoRef, {
                        uid: userDoc.id,
                        valor: valorInjecao,
                        tipo: tagMotivo,
                        descricao: `Presente de retorno! Sentimos sua falta.`,
                        timestamp: serverTimestamp()
                    });
                });
                contagem++;
            }
        }
        alert(`🎯 VARREDURA CONCLUÍDA!\n\n${contagem} usuários inativos foram bonificados.`);
    } catch (e) {
        console.error("Erro na varredura:", e);
        alert("Erro técnico ao bonificar inativos.");
    }
};
