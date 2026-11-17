'use strict';
/**
 * Localização pontual PT-BR de termos já verificados nas fontes oficiais
 * Crownicles 6.2.0.b. NÃO substitui os 8.403 textos nem altera Lang/pt.
 * A diferença entre Cavalier (HORSE_RIDER) e Knight foi preservada.
 */
const classLabels=Object.freeze({
 '0':'Recruta',
 '2':'Soldado',
 '4':'Enluvado',
 '5':'Combatente de Elmo',
 '6':'Combatente de Malha',
 '9':'Rebelde',
 '13':'Cavaleiro Montado',
 '14':'Piqueiro',
 '15':'Cavaleiro',
 '20':'Artilheiro Formidável',
 '24':'Mago Místico'
});
function classLabel(id,original){return Object.hasOwn(classLabels,String(id))?classLabels[String(id)]:original}
function tokenBalance(tokens){
 if(!tokens||!Number.isFinite(tokens.value))return null;
 const val=tokens.value.toLocaleString('pt-BR');
 const max=Number.isFinite(tokens.max)?` · recarga gratuita até ${tokens.max.toLocaleString('pt-BR')}`:'';
 return `Tokens: ${val}${max}`;
}
module.exports={classLabels,classLabel,tokenBalance};
