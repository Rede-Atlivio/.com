import { userProfile } from './auth.js';

export function atualizarCarteira() {
    const el = document.getElementById('user-balance');
    if(el && userProfile) {
        el.innerText = (userProfile.saldo || 0).toFixed(2).replace('.', ',');
    }
}
setInterval(atualizarCarteira, 5000);
