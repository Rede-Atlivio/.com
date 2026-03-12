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
    // 🛡️ Filtro Temporal Maestro V61: Ignora o "entulho" de notificações lidas antes do último refresh
    const lastSync = Number(localStorage.getItem('maestro_last_sync')) || 0;
    const dataLimite = new Date(lastSync);

    // 🎯 Ajuste de Mira Industrial: Além de não lidas, precisam ser posteriores à última limpeza do usuário
    const q = query(
        collection(window.db, "usuarios", uid, "notificacoes"), 
        where("read", "==", false),
        where("created_at", ">", dataLimite), 
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

        // 🛡️ Blindagem V50: Se o usuário já estiver na aba, silenciamos o alerta visual, mas FORÇAMOS a atualização dos dados
        if (jaEstaNoLugar) {
            console.log(`🔕 Maestro: Notificação de ${dados.action} silenciada, mas sincronizando dados em segundo plano...`);

            // 💰 Independência Financeira: Se a ação for saldo (wallet), chama a carteira mesmo em silêncio
            if ((dados.action === 'wallet' || dados.action === 'ganhar') && typeof window.iniciarMonitoramentoCarteira === 'function') {
                console.log("🪙 Maestro: Gatilho de saldo detectado. Atualizando interface...");
                window.iniciarMonitoramentoCarteira(); // Acorda o saldo imediatamente
            }

            // ✅ Baixa Automática: Marca como lida no banco para não ficar repetindo erro de "No document to update"
            if (typeof window.fecharNotificacao === 'function') {
                window.fecharNotificacao(notif.id); 
            }
            
            return; // Sai da função sem mostrar a barra azul, mas com o saldo já atualizado
        }

        mostrarBarraNotificacao(notif.id, dados);
    }); // Fechamento correto do OnSnapshot (escuta em tempo real)
}; // Fechamento correto da função escutarNotificacoes
// 🧠 PROCESSADOR DE ROTEIRO MAESTRO (O Robô que não dorme)

//AQUI EU VOU COLAR O QUE VOCE MANDAR
// 📡 RADAR MAESTRO V45: Escuta comandos diretos do Admin (Versão Estabilizada)
window.escutarComandosMaestro = (uid) => {
    const { doc, onSnapshot } = window.firebaseModules;
    
    // 🛡️ SINCRONIA: Vigia comandos, mas com filtro de segurança para não travar o sistema
    onSnapshot(doc(window.db, "maestro_commands", uid), (snap) => {
        try {
            if (snap.exists()) {
                const comando = snap.data();
                console.log("🛰️ Maestro: Novo comando recebido.");

                // Só dispara a barra se houver uma mensagem válida para evitar erros 'undefined'
                if (window.mostrarBarraNotificacao && comando.message) {
                    window.mostrarBarraNotificacao(snap.id, comando);
                }
            }
        } catch (err) {
            console.error("⚠️ [Maestro] Erro silencioso ao processar comando:", err);
        }
    });
};
window.processarFluxoAutomatico = async (user) => {
    try {
        // 🛡️ Passo 1: Busca o "Livro de Ordens" (JSON) usando os módulos já carregados na blindagem global
        // Isso evita que o sistema baixe o Firebase várias vezes, economizando dados e bateria do usuário.
        const snapMaestro = await getDoc(doc(window.db, "settings", "maestro_flow"));
        
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

       
      // 🎯 GATILHO DE EXPERIÊNCIA: Se o usuário estiver no dia certo da jornada, o balão azul aparece localmente.
        if (ordemDeHoje) {
            console.log("🎯 Maestro: Ordem encontrada para o dia do usuário. Exibindo alerta local...");
            
            // O sinal externo (celular apitando) é disparado pelo Admin. 
            // Aqui, apenas garantimos que o usuário veja o balão azul na tela enquanto navega.
            // 🎯 GATILHO V51: Sincroniza o Balão Azul com os nomes exatos do seu JSON (notificacao_1)
            if (window.mostrarBarraNotificacao) {
                // Decide se mostra a notificacao_1 ou 2 baseado na hora (Ex: Manhã e Noite)
                const msgData = (new Date().getHours() < 14) ? ordemDeHoje.notificacao_1 : ordemDeHoje.notificacao_2;
                
                window.mostrarBarraNotificacao("auto_" + diaAtualDoUsuario, {
                    titulo: msgData.titulo,
                    mensagem: msgData.mensagem,
                    type: 'marketing',
                    action: msgData.action || 'home'
                });
               } // 🛰️ Fim do IF (window.mostrarBarraNotificacao)
            } // 🎯 Fim do IF (ordemDeHoje)

    } catch (e) { // 🛡️ Captura erro do bloco try principal
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
    // 🛰️ MAPEAMENTO V51: Traduz o sinal do Robô para a interface do usuário.
    // O Robô envia 'titulo' e 'mensagem', garantimos que o site entenda exatamente isso.
    const icon = iconMap[data.type] || '🔔';
    const titulo = data.titulo || data.title || "Notificação Oficial";

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
                <p style="margin:2px 0 0; font-size:12px; color:white; font-weight:bold; line-height:1.2;">${data.mensagem || data.message || "Novidade disponível!"}</p>
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
// 🧼 FAXINA MAESTRO V40: Remove o balão e garante a baixa no Firebase usando módulos globais
// 🛰️ V155: Garante que a baixa da notificação ocorra na coleção correta do usuário
window.fecharNotificacao = async (id) => {
    const alerta = document.getElementById('user-alert-bar');
    if(alerta) alerta.remove(); 

    if (!id || id === 'undefined' || !auth.currentUser) return;
    const idString = id.toString();
    
    // Se for alerta automático do Maestro, apenas remove da tela
    if (idString.includes('auto_')) return;

    try {
        const { doc, updateDoc } = window.firebaseModules;
        // 🎯 AJUSTE DE MIRA: Agora aponta para a sub-coleção correta onde o histórico lê
        const notifRef = doc(window.db, "usuarios", auth.currentUser.uid, "notificacoes", idString);
        
        await updateDoc(notifRef, { read: true, atendido_em: new Date() });
        console.log("✅ [Maestro] Baixa registrada no histórico do usuário.");
    } catch(e) { console.warn("ℹ️ Notificação local ou já lida."); }
};
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
        
        // 🎯 Sincronia de Histórico V61: Busca as últimas 20 mensagens para exibir no histórico.
        const q = query(
            collection(window.db, "usuarios", uid, "notificacoes"),
            orderBy("created_at", "desc"),
            limit(20)
        );

        // 🎨 Injetor de Layout Dinâmico: Garante que no Desktop vire GRID e no Mobile fique em LISTA
        const containerPai = document.getElementById('lista-historico-notificacoes');
        if (containerPai) {
            containerPai.id = 'notif-list-container'; // Força o ID para o CSS que injetamos no app.js funcionar
        }

        const snap = await getDocs(q);

       // 🛡️ SINCRONIA INTELIGENTE V45: Só limpa o badge (bolinha) se o usuário abrir o histórico.
       // Removemos a faxina automática agressiva que matava o Balão Azul antes dele nascer.
        if (!snap.empty) {
           console.log(`✅ [Maestro] Histórico carregado: ${snap.size} mensagens encontradas.`);
           // A bolinha vermelha agora só some quando o usuário visualiza o histórico, 
           // mas não marca como "lido" no banco instantaneamente para não quebrar o tempo real.
        }
        if (snap.empty) {
            lista.innerHTML = '<p class="text-center text-gray-400 text-xs italic py-10">Nenhuma mensagem encontrada.</p>';
            return;
        }

        // 🎯 Mapeamento V66: O ícone do card agora combina com a ação da mensagem para escala de milhões
        const getIcon = (action) => {
            if (action === 'ganhar' || action === 'missoes') return '💰';
            if (action === 'contratar' || action === 'services') return '🛠️';
            if (action === 'loja' || action === 'produtos') return '🛍️';
            if (action === 'canal') return '📺';
            if (action === 'oportunidades') return '🏷️';
            return '🔔';
        };

     // 📱 Sincronia de Layout V62: Força o ID para ativar o CSS de Grid/Scroll que injetamos no app.js
        lista.id = 'notif-list-container'; 
        lista.className = ""; // Limpa classes antigas para não haver conflito com o novo ID

        // Renderiza as notificações mapeando os dados do banco para o HTML
        lista.innerHTML = snap.docs.map(doc => {
            const d = doc.data();
            const dataFormatada = d.created_at?.toDate().toLocaleDateString('pt-BR') || 'Recente';
            
            return `
                <div class="bg-white border border-gray-100 p-5 rounded-3xl shadow-sm flex items-start gap-4 w-full">
                    <div class="text-3xl flex-shrink-0">${getIcon(d.action)}</div>
                    <div class="flex-1">
                        <div class="flex justify-between items-start">
                            <p class="text-[10px] font-black text-blue-600 uppercase">${d.type || 'SISTEMA'}</p>
                            <p class="text-[8px] text-gray-400 font-bold">${dataFormatada}</p>
                        </div>
                        <h4 class="text-[11px] font-black text-slate-800 uppercase mt-1">${d.titulo || d.title || "Aviso Atlivio"}</h4>
                        <p class="text-xs text-gray-600 font-medium leading-tight">${d.mensagem || d.message || d.body || "Abra para ver os detalhes da oportunidade."}</p>
                        <button onclick="window.acaoNotificacao('${doc.id}', '${d.action}')" class="mt-3 text-[9px] font-black text-blue-500 uppercase tracking-widest hover:underline">
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

// 🛡️ FIAÇÃO REESTRUTURADA: O disparo externo (Cloud Run) agora é exclusivo do Módulo de Automação/Admin.
// Este arquivo agora foca 100% na experiência do usuário final e recepção de sinais.

// 🛰️ EXPOSIÇÃO DE ELITE: Disponibiliza as funções para o Sentinela e para o Painel Admin
// Sem estas linhas, o Admin não consegue dar ordens manuais ou automáticas.
window.carregarMaestro = window.iniciarSistemaNotificacoes; // 🔑 Chave de ignição para o Sentinela
window.dispararFluxoManual = window.processarFluxoAutomatico; // 🚀 Permite testes manuais via console
