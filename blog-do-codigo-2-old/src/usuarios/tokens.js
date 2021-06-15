const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const moment = require('moment');
const allowlistRefreshToken = require('../../redis/allowlist-refresh-token');
const blocklistAccessToken = require('../../redis/blocklist-access-token');
const {InvalidArgumentError} = require('../erros');

function criaTokenJWT(id, [TempoQuantidade, tempoUnidade] ) {
  const payload = {id};

  const token = jwt.sign(payload, process.env.CHAVE_JWT, {
    expiresIn: TempoQuantidade + tempoUnidade
  });
  return token;
}

async function criaTokenOpaco(id, [TempoQuantidade, tempoUnidade], allowlist) {
  const tokenOpaco = crypto.randomBytes(24).toString('hex');
  const dataExpiracao = moment().add(TempoQuantidade,tempoUnidade).unix();
  await allowlist.adiciona(tokenOpaco, id, dataExpiracao);
  return tokenOpaco;
}

async function verificaTokenJWT(token, blocklist){
    await verificaTokenNaBlocklist(token, blocklist);
    const {id} = jwt.verify(token, process.env.CHAVE_JWT);
    return id;
}

async function verificaTokenNaBlocklist(token, blocklist) {
  if(blocklist == null){
    console.log("testeee")
    return;
  }
  const tokenNaBlocklist = await blocklist.contemToken(token);
  if (tokenNaBlocklist) {
    throw new jwt.JsonWebTokenError('Token inválido por logout!');
  }
}

function invalidaTokenJWT(token, blocklist){
  return blocklist.adiciona(token);
}

async function verificaTokenOpaco(token, nome, allowlist) {
  verificaTokenEnviado(token, nome); 
  const id = await allowlist.buscaValor(token);
  verificaTokenValido(id, nome);
  return id;
}

async function invalidaTokenOpaco(token, allowlist) {
  return await allowlist.deleta(token);
}

function verificaTokenValido(id, nome) {
  if (!id) {
    throw new InvalidArgumentError(`${nome} Inválido!`);
  }
}

function verificaTokenEnviado(token, nome) {
  if (!token) {
    throw new InvalidArgumentError(`${nome} não enviado!`);
  }
}

module.exports = {
  access: {
    lista: blocklistAccessToken,
    expiracao: [15, 'm'],
    cria(id){
      return criaTokenJWT(id, this.expiracao);
    },
    verifica(token){
      return verificaTokenJWT(token,this.lista);
    },
    invalida(token){
      return invalidaTokenJWT(token, this.lista);
    }
  },
  refresh: {
    nome: 'Refresh token',

    lista: allowlistRefreshToken,
    expiracao: [5, 'd'],
    cria(id){
      return criaTokenOpaco(id, this.expiracao, this.lista);
    },
    verifica(token){
      return verificaTokenOpaco(token, this.nome, this.lista);
    },
    invalida(token){
      return invalidaTokenOpaco(token, this.lista)
    }

    
  },
  verificacaoEmail: {
    nome: 'Token de VErificação de e-mail',
    expiracao:[1, 'h'],
    cria(id){
      return criaTokenJWT(id, this.expiracao);
    },
    verifica(token){
      return verificaTokenJWT(token, this.nome);
    }
  }
}


