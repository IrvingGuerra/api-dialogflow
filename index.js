"use strict";
const express = require("express");
const bodyParser = require("body-parser");
const app = express();

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

app.post('/sacvog', function (req, res) {
  //Siempre pedimos departamentos y tramites en una peticion
  const departamentosArray = req.body.originalDetectIntentRequest.payload.dataDeptos || 'vacio';
  const dataTram = req.body.originalDetectIntentRequest.payload.dataTram || 'vacio';
  const idSession = req.body.originalDetectIntentRequest.payload.idSession || 'vacio';
  //CASO 1 // ¿Que deptos hay?
  const departamentos = req.body.queryResult.parameters.departamentos || 'vacio';  
  //CASO 2 // ¿Que tramites hay?
  const tramite = req.body.queryResult.parameters.tramite || 'vacio';     
  const deptoTramite = req.body.queryResult.parameters.depto || 'vacio'; 
  //CASO 3 // SOLICITA TRAMITE
  const depto = req.body.queryResult.parameters.depto || 'vacio';
  const documento = req.body.queryResult.parameters.documento || 'vacio'; 
  const yesOrNot = req.body.queryResult.parameters.yesornot || 'vacio';
  const dataExtra = req.body.queryResult.parameters.datosextras || 'vacio';

  let txtResponse = '';

  if (departamentos !== 'vacio'){
    console.log("[ OK ] - Solicita saber departamentos.");
    txtResponse = "Los departamentos que hay en tú unidad académica son. "
    departamentosArray.forEach((depto, i) => {
      if(i===departamentosArray.length-2){
        txtResponse+=depto.name+'.y ';
      }else{
        txtResponse+=depto.name+'. ';
      }
    });
    txtResponse = txtResponse.slice(0, txtResponse.length-2);
    responde(res, txtResponse); return;
  }else if(tramite !== 'vacio'){
    console.log("[ OK ] - Solicita saber tramites.");
    prettyJSON(departamentosArray);
    console.log(deptoTramite);
    const found = departamentosArray.find(d => sinDiacriticos(d.name) === sinDiacriticos(deptoTramite));
    console.log("[ INFO ] - Se localizó departamento: " + JSON.stringify(found, null, 4));
    if(found === undefined){
      txtResponse = "Lo siento, no encontré el departamento que mencionas en tú unidad académica.";
      responde(res, txtResponse); return;
    }
    let txtInicio = "Los trámites que emite el departamento de "+found.name+" son. ";
    let count = 0;
    dataTram.forEach(tramite => {
      if(tramite.departamento === found.id){
        count+=1;
        txtResponse+=tramite.name+'. '
      }
    });
    if(count === 0){
      txtInicio = "El departamento de "+found.name+" no emite trámites por el momento."
    }else if(count === 1){
      txtInicio = "El trámite que emite el departamento de "+found.name+" es. ";
    }
    txtInicio += txtResponse;
    responde(res, txtInicio); return;
  }else if(depto !== 'vacio' && documento !== 'vacio'){
    console.log("[ OK ] - Solicita un tramite!");
    console.log("Pidio: "+documento);
    //Buscamos el tramite
    const foundTramite = dataTram.find(d => sinDiacriticos(d.name) === sinDiacriticos(documento));
    if(foundTramite !== undefined){
      console.log("[ INFO ] - Se localizó el tramite que desea: " + JSON.stringify(foundTramite, null, 4));
      //Verificamos que pertenezca al depto
      const foundDepto = departamentosArray.find(d => sinDiacriticos(d.name) === sinDiacriticos(depto));
      console.log("[ INFO ] - Se localizó el depto del tramite: " + JSON.stringify(foundDepto, null, 4));
      if(foundTramite.departamento === foundDepto.id){
        if(foundTramite.extraData){
          txtResponse = "El trámite. "+foundTramite.name+" puede contener datos extras. ¿Desea escucharlos?";
          console.log("[ SENDING... ] - Enviando: " + txtResponse);
          res.json({
            fulfillmentText: txtResponse,
            source: "webhook-echo-sample",
            outputContexts: 
              [{
                name: "projects/sac-vog-cecebh/agent/sessions/"+idSession+"/contexts/pdf",
                lifespanCount: 3,
                parameters: {
                  doc:  foundTramite,
                  depto: foundDepto,
                  finish: false
                },
              },
              {
                name: "projects/sac-vog-cecebh/agent/sessions/"+idSession+"/contexts/solicitatramite-followup",
                lifespanCount: 3,
              },
              {
                name: "projects/sac-vog-cecebh/agent/sessions/"+idSession+"/contexts/solicitatramite-yes-followup",
                lifespanCount: 3,
              }]
          });
          return;
        }else{
          txtResponse = "Su documento de visualización para el trámite "+foundTramite.name+" se acaba de generar. Visualízalo. y diga si es correcto o incorrecto.";
          console.log("[ SENDING... ] - Enviando: " + txtResponse);
          res.json({
            fulfillmentText: txtResponse,
            source: "webhook-echo-sample",
            outputContexts: 
            [{
              name: "projects/sac-vog-cecebh/agent/sessions/"+idSession+"/contexts/pdf",
              lifespanCount: 1,
              parameters: {
                doc: foundTramite,
                depto: foundDepto,
                finish: true
              },
            }]
          });
          return;
        }
      }else{
        txtResponse = "Lo siento. El trámite. "+foundTramite.name+" no es de "+foundDepto.name;
        responde(res, txtResponse); return;
      }
    }else{
      txtResponse = "Lo siento. El trámite. "+documento+" no es existe en ningun departamento.";
      responde(res, txtResponse); return;
    }

    
  }else if(yesOrNot !== 'vacio'){
    let index = 0;
    req.body.queryResult.outputContexts.forEach(function (contexto, i) {
      if(contexto.name.includes('pdf')){
        index = i;
      }
    });
    let doc = req.body.queryResult.outputContexts[index].parameters.doc;
    let depto = req.body.queryResult.outputContexts[index].parameters.depto;
    if(yesOrNot === 'si'){
      let miss = doc.extraData;
      txtResponse = "Los datos extras que puede contener: "+doc.name+" son. "
      miss.forEach(falta => {
        txtResponse+=falta.nameVar.replace('alumno_','').replace('_',' ')+'. '
      });
      txtResponse += " ¿Desea agregar alguno?."
      console.log("[ SENDING... ] - Enviando: " + txtResponse);
      const extras = [];
      res.json({
        fulfillmentText: txtResponse,
        source: "webhook-echo-sample",
        outputContexts: 
          [{
            name: "projects/sac-vog-cecebh/agent/sessions/"+idSession+"/contexts/pdf",
            lifespanCount: 3,
            parameters: {
              doc:  doc,
              depto: depto,
              miss: miss, //Inicialmente con todas
              extras: extras, //Inicialmente vacio
              finish: false
            },
          },
          {
            name: "projects/sac-vog-cecebh/agent/sessions/"+idSession+"/contexts/solicitatramite-followup",
            lifespanCount: 3,
          },
          {
            name: "projects/sac-vog-cecebh/agent/sessions/"+idSession+"/contexts/solicitatramite-yes-followup",
            lifespanCount: 3,
          }]
      });
      return;
    }else{
      txtResponse = "Su documento de visualización para el trámite "+doc.name+" se acaba de generar. Visualízalo. y diga si es correcto o incorrecto.";
      console.log("[ SENDING... ] - Enviando: " + txtResponse);
      res.json({
        fulfillmentText: txtResponse,
        source: "webhook-echo-sample",
        outputContexts: 
          [{
            name: "projects/sac-vog-cecebh/agent/sessions/"+idSession+"/contexts/pdf",
            lifespanCount: 1,
            parameters: {
              doc: doc,
              depto: depto,
              finish: true
            },
          }]
      });
      return;
    }
  }else if(dataExtra !== 'vacio'){
    //Obtenemos los datos del contexto
    let index = 0;
    req.body.queryResult.outputContexts.forEach(function (contexto, i) {
      if(contexto.name.includes('pdf')){
        index = i;
      }
    });
    let doc = req.body.queryResult.outputContexts[index].parameters.doc;
    let depto = req.body.queryResult.outputContexts[index].parameters.depto;
    let miss = req.body.queryResult.outputContexts[index].parameters.miss;
    let extras = req.body.queryResult.outputContexts[index].parameters.extras;

    let exist = false;
    miss.forEach(variable => {
      if(dataExtra.replace(' ','_') === variable.nameVar.replace('alumno_','')){
        exist = true;
        extras.push(variable);
        txtResponse = "Se agregó la variable "+variable.nameVar.replace('alumno_','')+" a su documento. ";
        //Y se remueve de miss
        miss = miss.filter(v => v.id !== variable.id);
      }
    });
    if(exist === false){
      txtResponse = "Lo siento, ese parametro extra no existe. Solo puedes agregar los siguientes parametros. ";
      miss.forEach(falta => {
        txtResponse+=falta.nameVar.replace('alumno_','').replace('_',' ')+'. '
      });
      txtResponse += " ¿Desea agregar alguno?."
      console.log("[ SENDING... ] - Enviando: " + txtResponse);
      res.json({
        fulfillmentText: txtResponse,
        source: "webhook-echo-sample",
        outputContexts: 
          [{
            name: "projects/sac-vog-cecebh/agent/sessions/"+idSession+"/contexts/pdf",
            lifespanCount: 3,
            parameters: {
              doc:  doc,
              depto: depto,
              miss: miss,
              extras: extras,
              finish: false
            },
          },
          {
            name: "projects/sac-vog-cecebh/agent/sessions/"+idSession+"/contexts/solicitatramite-followup",
            lifespanCount: 3,
          },
          {
            name: "projects/sac-vog-cecebh/agent/sessions/"+idSession+"/contexts/solicitatramite-yes-followup",
            lifespanCount: 3,
          }
          ]
      });
      return;
    } else{
        //Si existe, se añade y se pregunta por otro
        if(miss.length > 0){
          txtResponse += "Aun quedan las siguientes variables extras. "
          miss.forEach(falta => {
            txtResponse+=falta.nameVar.replace('alumno_','').replace('_',' ')+'. '
          });
          txtResponse += " ¿Desea agregar alguno?."
          console.log("[ SENDING... ] - Enviando: " + txtResponse);
          res.json({
            fulfillmentText: txtResponse,
            source: "webhook-echo-sample",
            outputContexts: 
              [{
                name: "projects/sac-vog-cecebh/agent/sessions/"+idSession+"/contexts/pdf",
                lifespanCount: 3,
                parameters: {
                  doc:  doc,
                  depto: depto,
                  miss: miss,
                  extras: extras,
                  finish: false
                }
              },
              {
                name: "projects/sac-vog-cecebh/agent/sessions/"+idSession+"/contexts/solicitatramite-followup",
                lifespanCount: 3,
              },
              {
                name: "projects/sac-vog-cecebh/agent/sessions/"+idSession+"/contexts/solicitatramite-yes-followup",
                lifespanCount: 3,
              }]
          });
          return;
        }else{
          txtResponse = "Su documento de visualización para el trámite "+doc.name+" se acaba de generar. Visualízalo. y diga si es correcto o incorrecto.";
          console.log("[ SENDING... ] - Enviando: " + txtResponse);
          res.json({
            fulfillmentText: txtResponse,
            source: "webhook-echo-sample",
            outputContexts: 
            [{
              name: "projects/sac-vog-cecebh/agent/sessions/"+idSession+"/contexts/pdf",
              lifespanCount: 1,
              parameters: {
                doc: doc,
                depto: depto,
                finish: true
              },
            }]
          });
          return;
        }
        
    }
  }

  res.json({
    fulfillmentText: 'Lo siento, no entendí lo que solicitaste. ¿Podrías repetirlo?',
    source: "webhook-echo-sample"
  });
});

app.listen(process.env.PORT || 8000, function() {
  console.log("Server up and listening in port 8000");
});


function sinDiacriticos(texto) {
  return texto
         .normalize('NFD')
         .replace(/([^n\u0300-\u036f]|n(?!\u0303(?![\u0300-\u036f])))[\u0300-\u036f]+/gi,"$1")
         .normalize()
         .toLowerCase()
         .trim();
}

function prettyJSON(obj) {
  console.log(JSON.stringify(obj, null, 4));
}

function responde(res, txtResponse){
  console.log("[ SENDING... ] - Enviando: " + txtResponse);
  res.json({
    fulfillmentText: txtResponse,
    source: "webhook-echo-sample",
  })
}