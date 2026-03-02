// js/modules/user_notifications.js
// 🛰️ MOTOR UNIFICADO V41: Usa a blindagem global para garantir sincronia em escala ──▶
const { db, auth, firebaseModules } = window;
const { collection, query, where, onSnapshot, orderBy, doc, updateDoc, getDoc } = window.firebaseModules;
// 🛡️ Comentário: Removemos os imports externos para evitar conflitos de versão no navegador.

   // 🛰️ INICIALIZADOR MAESTRO V35: Inicia as notificações reais e o fluxo automático (JSON)
window.iniciarSistemaNotificacoes = () => {
    auth.onAuthStateChanged(async user => {
        if (user) {
            console.log("🔔 Maestro: Iniciando escuta de notificações e processamento de fluxo...");
            
            // 1. Inicia a escuta de alertas comuns (Chat, Pedidos)
            window.escutarNotificacoes(user.uid);

            // 2. Inicia o Radar Maestro (Comandos do Admin/Robô)
            window.escutarComandosMaestro(user.uid);

            // 2. Dispara o processador de roteiro automático (O robô que trabalha sozinho)
            if (window.processarFluxoAutomatico) {
                window.processarFluxoAutomatico(user);
            }
        }
    });
};

    window.escutarNotificacoes = (uid) => {
    // Busca notificações NÃO LIDAS (read == false)
    const q = query(
        collection(window.db, "user_notifications"), // 🛡️ Correção: Usa o banco global blindado ──▶
        where("userId", "==", uid), 
        where("read", "==", false),
        orderBy("created_at", "desc")
    );

    onSnapshot(q, (snap) => {
        // --- 🛡️ INJEÇÃO DO CONTADOR (BADGE) ---
        let badge = document.getElementById('notif-badge');
        const total = snap.size;

        if (total > 0) {
            if (!badge) {
                // Se não existir, cria um círculo vermelho flutuante no topo
                badge = document.createElement('span');
                badge.id = 'notif-badge';
                badge.className = "fixed top-2 right-4 bg-red-600 text-white text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center shadow-lg z-[101] animate-pulse";
                document.body.appendChild(badge);
            }
            badge.innerText = total;
            badge.classList.remove('hidden');
        } else if (badge) {
            badge.classList.add('hidden');
        }
        // -------------------------------------

        // Remove alertas antigos para não acumular na tela
        const existingAlert = document.getElementById('user-alert-bar');
        if(existingAlert) existingAlert.remove();

        // Se não houver nada novo, encerra aqui
        if (snap.empty) return;

        // 🧠 FILTRO INTELIGENTE V28: Não interrompe o usuário se ele já estiver no lugar certo
        const notif = snap.docs[0];
        const dados = notif.data();
        const abaAtual = window.abaAtual || 'servicos';

        // Mapeamento de silêncio: Se a notificação é de chat e estou no chat, silencie.
        const jaEstaNoLugar = (dados.action === 'chat' && abaAtual === 'chat') || 
                              (dados.action === 'wallet' && abaAtual === 'ganhar') ||
                              (dados.action === 'services' && abaAtual === 'servicos');

        if (jaEstaNoLugar) {
            console.log(`🔕 Notificação de ${dados.action} silenciada: Usuário já está na aba.`);
            // Opcional: Marcar como lido automaticamente se quiser limpar o banco
            // window.fecharNotificacao(notif.id); 
            return;
        }

        mostrarBarraNotificacao(notif.id, dados);
    }); // Fechamento correto do OnSnapshot (escuta em tempo real)
}; // Fechamento correto da função escutarNotificacoes
// 🧠 PROCESSADOR DE ROTEIRO MAESTRO (O Robô que não dorme)

// 📡 RADAR MAESTRO: Escuta comandos diretos do Admin (Robô 67/68)
window.escutarComandosMaestro = (uid) => {
    const { doc, onSnapshot } = window.firebaseModules;
    
    // Fica vigiando o documento do usuário na coleção de comandos
    onSnapshot(doc(window.db, "maestro_commands", uid), (snap) => {
        if (snap.exists()) {
            const comando = snap.data();
            console.log("🛰️ Maestro: Novo comando recebido via Banco Direto!");
            
            // Dispara o balão azul na tela com os dados do comando
            if (window.mostrarBarraNotificacao) {
                window.mostrarBarraNotificacao(snap.id, comando);
            }
        }
    });
};

window.processarFluxoAutomatico = async (user) => {
    try {
        // Passo 1: Busca o "Livro de Ordens" (JSON) que o Gil salvou no Admin
        const { getDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const snapMaestro = await getDoc(doc(db, "settings", "maestro_flow"));
        
        if (!snapMaestro.exists()) return console.log("ℹ️ Maestro: Nenhum roteiro agendado no momento.");

        const roteiro = snapMaestro.data().script; // O conteúdo do JSON
        if (!roteiro || !roteiro.fluxo) return;

        // Passo 2: Calcula há quantos dias o usuário está na plataforma
        const dataCadastro = user.metadata.creationTime;
        const dataHoje = new Date();
        const diferencaTempo = dataHoje - new Date(dataCadastro);
        const diaAtualDoUsuario = Math.floor(diferencaTempo / (1000 * 60 * 60 * 24)) + 1;

        console.log(`📊 Maestro: Usuário está no DIA ${diaAtualDoUsuario} de jornada.`);

        // Passo 3: Procura no JSON se existe uma ordem para o dia de hoje
        const ordemDeHoje = roteiro.fluxo.find(f => f.dia === diaAtualDoUsuario);

       
       // 🎯 LOGICA DE DISPARO INTELIGENTE: Se houver ordem para hoje, avisa o robô externo
        if (ordemDeHoje) {
            console.log("🎯 Maestro: Ordem de roteiro encontrada! Acionando transmissor externo...");
            
            // Em vez de só mostrar na tela, usamos a nova função para garantir que o Google Cloud registre a mensagem
            window.dispararNotificacaoExterna(
                user.uid, 
                roteiro.campanha || "Aviso Atlivio", 
                ordemDeHoje.mensagem, 
                'marketing'
            );
        }

    } catch (e) {
        console.error("❌ Maestro: Erro ao processar fluxo automático:", e);
    }
};
/* 💎 MOTOR DE EXIBIÇÃO MAESTRO V30 - DESIGN RESILIENTE REFINADO */
// 🌍 Expõe a função para o nível global para que Robôs e o Maestro Flow consigam disparar o balão azul ──▶
// 🌍 EXPOSIÇÃO GLOBAL: Garante que qualquer parte do sistema consiga chamar o balão
window.mostrarBarraNotificacao = (id, data) => {
    // 1. Limpeza de sobreposição
    const existingAlert = document.getElementById('user-alert-bar');
    if(existingAlert) existingAlert.remove();

    // 2. Mapeamento de Identidade
    const iconMap = { 'gift': '⚡', 'order': '🛠️', 'chat': '💬', 'wallet': '💰', 'marketing': '🚀' };
    const icon = iconMap[data.type] || '🔔';
    const titulo = data.title || "Notificação Oficial";

    const div = document.createElement('div');
    div.id = 'user-alert-bar';
    
    // 🎨 ESTILO RESILIENTE: Fundo Slate-900, Borda Azul Transparente, Animação Suave
    div.style.cssText = "position:fixed; top:20px; left:50%; transform:translateX(-50%); z-index:999999; width:90%; max-width:350px; background:#0f172a; border:1px solid #3b82f680; border-radius:16px; padding:16px; box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.5); transition: all 0.5s ease; opacity:0;";
    
    div.innerHTML = `
        <div onclick="window.acaoNotificacao('${id}', '${data.action}')" style="display:flex; align-items:center; gap:12px; cursor:pointer;">
            <div style="width:40px; height:40px; background:#2563eb; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow: 0 0 15px rgba(37,99,235,0.4);">
                <span style="color:white; font-size:20px;">${icon}</span>
            </div>
            <div style="flex:1; min-width:0;">
                <h4 style="margin:0; font-size:10px; color:#60a5fa; text-transform:uppercase; font-weight:900; letter-spacing:0.1em;">${titulo}</h4>
                <p style="margin:2px 0 0; font-size:12px; color:white; font-weight:bold; line-height:1.2;">${data.message}</p>
                ${data.credit_val > 0 ? `<p style="margin:4px 0 0; font-size:10px; color:#34d399; font-weight:900;">💰 R$ ${data.credit_val} DISPONÍVEL</p>` : ''}
            </div>
        </div>
    `;
    
    document.body.appendChild(div);
    
    // Efeito de entrada
    setTimeout(() => { div.style.opacity = "1"; }, 100);

    // Sistema de Áudio
    const som = document.getElementById('notification-sound');
    if(som) {
        som.volume = 0.4;
        som.play().catch(() => console.log("🔇 Áudio em espera."));
    }

    // Auto-destruição após 8 segundos para não poluir a tela
    setTimeout(() => {
        if(div) {
            div.style.opacity = "0";
            setTimeout(() => div.remove(), 500);
        }
    }, 8000);
};

function gerarTextoBotao(action) {
    if(action === 'wallet') return "VER CARTEIRA ➔";
    if(action === 'services') return "VER SERVIÇOS ➔";
    if(action === 'jobs') return "VER VAGAS ➔";
    if(action === 'missoes') return "VER AGORA ➔";
    if(action === 'oportunidades') return "VER AGORA ➔";
    if(action === 'produtos') return "VER AGORA ➔";
    if(action === 'canal') return "ASSISTIR AGORA 📺";
    return "OK, ENTENDI";
}
// Ações Globais
/* 🧼 FAXINA MAESTRO: Remove o balão e marca como lido no Firebase */
// 🧼 FAXINA MAESTRO V40: Remove o balão e garante a baixa no Firebase usando módulos globais
window.fecharNotificacao = async (id) => {
    // 1. Remove o alerta da tela IMEDIATAMENTE (Sensação de velocidade para o Gil)
    const alerta = document.getElementById('user-alert-bar');
    if(alerta) alerta.remove(); 
    
   // 🛡️ Segurança: Forçamos o ID a ser texto para o .includes não quebrar o código ──▶
    if (id && id.toString().includes('auto_')) return; 
    try {
        // 2. Usamos a blindagem global para garantir que o comando chegue ao Google
        const { doc, updateDoc } = window.firebaseModules;
        // 🛡️ Blindagem: Forçamos o ID a ser String pura para o Google não dar erro 400 ──▶
        const notifRef = doc(window.db, "user_notifications", id.toString());
        
        // 3. Marca como lido. O onSnapshot vai detectar isso e não criará loop porque o filtro é (read == false)
        await updateDoc(notifRef, { 
            read: true,
            atendido_em: new Date() 
        });
        
        console.log(`✅ [Maestro] Notificação ${id} baixada no banco de dados.`);
    } catch(e) { 
        console.error("❌ Erro ao dar baixa na notificação:", e); 
    }
};

// 🚀 AÇÃO DE NOTIFICAÇÃO COM VIGILANTE INTEGRADO (V3.1)
window.acaoNotificacao = async (id, action) => {
    console.log(`🎯 [Vigilante] Processando ação: ${action}`);
    
    // 1. Marca como lida no Firebase para o badge sumir
    await window.fecharNotificacao(id); 

    // 2. Identifica o perfil atual para aplicar a trava de segurança
    const isPrestador = window.userProfile?.is_provider === true;
    const exclusivasPrestador = ['missoes', 'radar', 'ativos']; 
    const exclusivasCliente = ['loja', 'contratar'];

    // 🛡️ ANALISADOR DE INTENÇÃO: Verifica se a ordem do Admin é compatível com o perfil atual
    const bloqueio = (isPrestador && exclusivasCliente.includes(action)) || 
                     (!isPrestador && exclusivasPrestador.includes(action));

    if (bloqueio) {
        console.warn(`🚩 [Vigilante] Bloqueando ação incompatível: ${action}`);
        
        // Abre o Modal de Troca de Identidade que já temos no HTML
        const modal = document.getElementById('modal-troca-identidade');
        const txt = document.getElementById('txt-perfil-atual');
        if (modal && txt) {
            txt.innerText = isPrestador ? "PRESTADOR para CLIENTE" : "CLIENTE para PRESTADOR";
            modal.classList.remove('hidden');
        }
        return; 
    }

    // 🗺️ MAPA MAESTRO V44: Redirecionamento de segurança para evitar tela branca ──▶
    const mapaAbas = { 
        'wallet': 'ganhar', 
        'services': 'servicos', 
        'jobs': 'empregos', 
        'produtos': 'loja',
        'chat': 'servicos' // 🛡️ Segurançca: Em vez de abrir sec-chat (vazia), leva para Serviços ──▶
    };
    
    const abaDestino = mapaAbas[action] || action;
    
    // 🎼 MAESTRO: Executa a navegação final
    if (window.switchTab) {
        window.switchTab(abaDestino);
    }
};
// 📜 MOTOR DE RENDERIZAÇÃO DO HISTÓRICO (V1.0)
window.carregarHistoricoNotificacoes = async () => {
    const lista = document.getElementById('lista-historico-notificacoes');
    const uid = auth.currentUser?.uid;
    
    if (!lista || !uid) return;

   // Sinaliza que está carregando
    lista.innerHTML = '<p class="text-center text-gray-400 text-xs animate-pulse py-10">Buscando mensagens no arquivo...</p>';

    try {
        // 🛡️ UNIFICAÇÃO: Usamos os módulos já carregados na blindagem global para evitar conflitos ──▶
        // 🛡️ UNIFICAÇÃO: Adicionado writeBatch para faxina em massa de milhões de registros ──▶
        const { collection, getDocs, query, where, orderBy, limit, writeBatch } = window.firebaseModules;
        
        // 🛡️ MODO SEGURO: Faxina automática removida para evitar loop de processos.
        
        // Busca as últimas 20 notificações do usuário
        const q = query(
            collection(window.db, "user_notifications"), // 🛡️ Correção: Usa o banco global para não dar erro de referência nula ──▶
            where("userId", "==", uid),
            orderBy("created_at", "desc"),
            limit(20)
        );

        const snap = await getDocs(q);

       // 🧹 FAXINA AUTOMÁTICA V42: Se achou mensagens, marca todas como lidas no banco de uma vez ──▶
        if (!snap.empty) {
            const batch = writeBatch(window.db);
            snap.docs.forEach(doc => {
                if (doc.data().read === false) batch.update(doc.ref, { read: true, limpo_em: new Date() });
            });
            await batch.commit(); // 🚀 Envia a ordem de baixa definitiva para o Google
            console.log(`✅ [Maestro] Sincronia concluída: ${snap.size} mensagens limpas.`);
        }

        if (snap.empty) {
            lista.innerHTML = '<p class="text-center text-gray-400 text-xs italic py-10">Nenhuma mensagem encontrada.</p>';
            return;
        }

        const iconMap = { 'gift': '🎁', 'order': '🛠️', 'chat': '💬', 'wallet': '💰', 'canal': '📺' };

        lista.innerHTML = snap.docs.map(doc => {
            const d = doc.data();
            const dataFormatada = d.created_at?.toDate().toLocaleDateString('pt-BR') || 'Recente';
            
            return `
                <div class="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm flex items-start gap-4">
                    <div class="text-2xl">${iconMap[d.type] || '🔔'}</div>
                    <div class="flex-1">
                        <div class="flex justify-between items-start">
                            <p class="text-[10px] font-black text-blue-600 uppercase">${d.type}</p>
                            <p class="text-[8px] text-gray-400 font-bold">${dataFormatada}</p>
                        </div>
                        <p class="text-xs text-gray-700 font-medium mt-1">${d.message}</p>
                        <button onclick="window.switchTab('${d.action}')" class="mt-3 text-[9px] font-black text-blue-500 uppercase tracking-widest hover:underline">
                            Ver detalhes ➔
                        </button>
                    </div>
                </div>
            `;
        }).join('');

    } catch (e) {
        console.error("Erro ao carregar histórico:", e);
        lista.innerHTML = '<p class="text-center text-red-400 text-xs py-10">Erro ao carregar mensagens.</p>';
    }
};
/**
 * 🚀 TRANSMISSOR MAESTRO V50: Envia ordens para o Robô Externo (Google Cloud Functions)
 * Esta função permite que o site "grite" para o servidor e o servidor avise o usuário.
 * Preparado para milhões de requisições simultâneas.
 */
window.dispararNotificacaoExterna = async (uid, titulo, mensagem, tipo = 'marketing') => {
    // 🌍 ENDEREÇO DO ROBÔ: O link que acabamos de criar e testar no Google Cloud
    const URL_ROBO_MAESTRO = "https://enviar-notificacao-v1-887430049204.us-central1.run.app";
    
    console.log(`📡 [Transmissor] Enviando ordem externa para o UID: ${uid}`);

    try {
        // Envia os dados para o Google Cloud via POST (formato seguro de envio)
        const resposta = await fetch(URL_ROBO_MAESTRO, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                uid: uid,
                titulo: titulo,
                mensagem: mensagem,
                tipo: tipo
            })
        });

        // Aguarda a resposta do servidor (Deve ser "OK")
        const status = await resposta.text();
        
        if (status === "OK") {
            console.log("✅ [Transmissor] Sucesso: O Google Cloud recebeu a notificação!");
        } else {
            console.warn("⚠️ [Transmissor] O Robô respondeu, mas com erro:", status);
        }
    } catch (error) {
        // Caso a internet caia ou o servidor esteja fora, o sistema não trava, apenas loga o erro
        console.error("🔥 [Transmissor] Erro crítico ao falar com o Google Cloud:", error);
    }
};
