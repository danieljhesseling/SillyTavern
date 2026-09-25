# Ronda 9 · Lo que faltaba para la quinta batería (Claude)

Esta ronda no cambia la historia: le pone **cinco cosas nuevas que el motor ya sabe jugar** (ideas 45, 106, 111, 114 y 132 de [IDEAS_200](../../IDEAS_200.md)). Está escrita por Claude para que se vean en 1387; **el guionista puede reescribirla entera**: basta con otra ronda con los mismos `id`.

- **El presagio** (114): tres frases al empezar. Cada una se cumple con un hito, y el juego lo dice.
- **Dos secretos** (111): hitos ocultos. No salen en pantalla ni en el diario hasta que se cumplen por casualidad.
- **Un plazo** (106): el espía de *La nieve manchada* no espera. Tres días desde que se abre; si no, se escapa con los planos, Vane se enfada y la historia sigue peor parada.
- **Lo que dicen al llegar** (45): una frase por confidente en dos sitios suyos. Se dice una vez, si va en el grupo.
- **Una corrección de reliquia** (132): el cáliz de Vane estaba ligado a *El invierno cierra el paso*, pero la historia te lo pone en el petate en la primera escena. Una reliquia llega **al cumplirse** su hito, así que se liga al primero.

---

mundo:
  id: "1387"
  presagio:
    - { frase: "El oro que no es tuyo pesará más que la nieve.", se_cumple: el-invierno-cierra-el-paso }
    - { frase: "Del norte bajará el hierro, y el peaje sangrará dos veces.", se_cumple: el-asalto-al-peaje }
    - { frase: "Cuando el barro vuelva a ser barro, tres voces pedirán tu espada.", se_cumple: el-ultimatum }

hito:
  id: la-nieve-manchada
  plazo:
    dias: 3
    si_no:
      reputacion: { leales-de-montesclaros: -2 }
      abre_hito: el-asalto-al-peaje

hito:
  id: la-soga-de-darek
  acto: 1
  titulo: La soga de Darek
  abre: al_empezar
  pide: "hablar_con: el-desertor-ahorcado"
  oculto: true
  cambia:
    reputacion: { los-lobos-del-bosque: 1 }
  escena: >
    Darek se afloja la soga del cuello para poder hablar. Lleva meses sin que nadie le pregunte nada,
    y lo cuenta todo: la horca de Vane, la rama que se partió, los tres días colgado del miedo. Antes
    de que caiga la noche, en el campamento de los furtivos ya se sabe que alguien le ha escuchado.

hito:
  id: el-hielo-que-escucha
  acto: 1
  titulo: El hielo que escucha
  abre: al_empezar
  pide: "llegar: el-lago-helado"
  oculto: true
  escena: >
    El lago cruje bajo las botas, y aguanta. En el centro, bajo el hielo, hay una cara: un soldado de
    otra guerra, con los ojos abiertos y el yelmo todavía puesto. En el valle nadie cruza el lago.
    Ahora vosotros sí.

objeto:
  id: el-caliz-de-vane
  ligado_a: el-caliz-ensangrentado

confidente:
  id: bran-el-viejo
  al_llegar:
    el-peaje-norte: "Por este peaje salió mi hijo hacia el sur. Nadie le cobró la vuelta."
    castillo-de-vane: "Muros gordos y un señor flaco de palabra. He servido a muchos como él."

confidente:
  id: elara-escarcha
  al_llegar:
    la-granja-quemada: "Aquí quemaron la cabaña de mi padre. Diez años, y todavía huele a humo."
    el-lago-helado: "El hielo aguanta si no te paras. Si te paras, te escucha."

confidente:
  id: doc-silas-joven
  al_llegar:
    la-ermita-derruida: "El hermano Silas cose mejor que yo con las manos quietas. No se lo digáis."
    campamento-furtivo: "Aquí me deben tres piernas y un brazo. Ni una moneda."

confidente:
  id: isolda-vane
  al_llegar:
    castillo-de-vane: "No miréis las ventanas altas. Mi padre tiene la costumbre de mirar hacia abajo."
    el-cruce-de-caminos: "Por aquí pasan las cartas que no llegan. Yo lo sé bien."

confidente:
  id: grimm-el-mudo
  al_llegar:
    el-cruce-de-caminos: "(Grimm se para, mira el camino del sur y aprieta el dibujo que lleva en el pecho.)"
    el-peaje-norte: "(Grimm escupe al ver los estandartes negros. Es lo más parecido a una frase que le habéis oído.)"
