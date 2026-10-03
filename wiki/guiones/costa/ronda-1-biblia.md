# La costa que no duerme — ronda 1: la biblia

> Escrita por Claude (tanda 20) como lo haría el Gem guionista, en rondas de Markdown con bloques
> YAML. `node tools/guion-a-paquete.mjs wiki/guiones/costa` las junta en `public/mundos/costa.pack.json`.
> Lo que el conversor no sabía leer (las conversaciones, el aspecto, las salidas de una pelea, los
> romances…) va en `paquete:`, con la forma del paquete tal cual (`wiki/GEM_CREAR_CAMPANA_ANEXO.md`).

## La premisa y el tono

Mareaviva es un pueblo de pescadores en una bahía cerrada por dos puntas: al norte, el faro; al sur,
el Bajo, una barrera de rocas que solo asoma con la marea baja. Hace treinta años, una galerna se llevó
treinta y siete vidas en una noche. Desde entonces, en la bahía no se ha ahogado nadie. Ni un niño, ni
un borracho, ni un forastero. Las capturas son buenas y los niños nacen sanos. En el pueblo eso no se
celebra: se calla.

El tono es el miedo a lo que no se ve. Nadie grita. La gente habla bajo, con frases cortas, y cambia
de tema. El ambiente lo dice quien tiene miedo: frío y paciente.

## Lo que este mundo no tiene

- **Magos.** Hay clérigos (que rezan y curan con vendas), eruditos, soldados, exploradores y pícaros.
- **Razas fantásticas.** Hay humanos, y dos clases de gente de la costa: los **braceados**, que nacieron
  después del trato y nadan como peces, y los **marcados**, que tocaron algo de niños y ven lo que los
  demás no.
- **Una victoria a espadazos.** Lo que hay en el agua no se mata. Se gana entendiendo qué se le
  prometió y quién lo firmó.

## El trato (lo que nadie cuenta)

Después de la galerna, el pueblo se moría. En la bajamar grande de la primavera siguiente, la marea más
baja del año, cinco personas entraron andando en el Bajo:

- **Rosalía Arrieta**, viuda del dueño de la Salazón, que lo negoció;
- **Don Fermín**, el cura, que lo bendijo;
- **Ane Goikoa**, de ocho años, la hija del farero, que conocía el camino porque iba a por percebes con su padre;
- y en la barca esperaban **Mateo Iturbe** y **Jacinto Larrañaga**, que remaron.

Dentro, en una pared llena de manos pintadas (unas muy viejas), les habló la **Vecina**, lo que vive en el
agua. Estaba sola. Pidió compañía. Rosalía le ofreció a los muertos del pueblo: «Se quedarán contigo para
siempre». La Vecina aceptó, y a cambio no se llevaría a ningún vivo de la bahía. Firmaron con la mano
mojada en tinta de calamar: Rosalía, Don Fermín y la niña, porque la Vecina quiso «una mano que dure».

Lo que dice la pared, palabra por palabra (lo copió el farero Martín Goikoa en su cuaderno):

1. Ningún vivo de la bahía morirá en el agua.
2. Los muertos de Mareaviva serán del agua, y le harán compañía.
3. El trato dura lo que dure la mano más joven que lo firmó.
4. Si falta un muerto, la Vecina vendrá a buscar compañía entre los vivos.

Y la nota del farero: **la mano que firmó puede volver a la pared y quitarse, por su propia voluntad,
en la bajamar grande.** Lo que se da por las buenas, por las buenas se devuelve.

Lo que Rosalía no entendió: los muertos que se dan al agua no descansan. Se quedan despiertos para hacer
compañía. Son los **desvelados**, y cada noche suben por los postes del embarcadero viejo buscando a los
vivos. Por eso existe **la Vela**: cada noche alguien se sienta en la última tabla y les habla hasta que
amanece. Si nadie les habla, suben al pueblo.

## El conflicto

Hace nueve días murió Mateo Iturbe. Su hijo Lucio no quiso echarlo al mar y lo enterró de noche en el
cementerio viejo, el primero en tierra en treinta años. **Falta un muerto.** Desde entonces la marea no
baja como debe, los desvelados suben más alto cada noche y los niños caminan dormidos hacia el agua. La
cuarta cláusula se está cumpliendo.

- **Rosalía** quiere que el trato siga para siempre. Su plan: en la próxima bajamar grande, que firme una
  mano más joven que la de Ane, la de la niña Uxue Lasarte.
- **Lucio** quiere acabar con el trato. Ha leído en los papeles de su padre que dura lo que viva la mano
  más joven, y quiere encontrar esa mano y cortarla. No sabe que, si se rompe a la fuerza, la Vecina se
  cobra la deuda con los niños.
- **Ane** no recuerda bien lo que hizo de niña. Solo sueña con una pared llena de manos.

## La mecha

Llegas a Mareaviva al caer la tarde, con la carta de la maestra en el bolsillo. En el muelle, una niña
camina dormida hacia el agua y se mete en el mar. Nadie corre a por ella. Sale sola, empapada, y dice con
una voz que no es la suya: «Falta uno».

## Los finales

- **La costa duerme**: Ane devuelve su mano a la pared. El trato se acaba, los muertos por fin duermen y
  la bahía vuelve a ser un mar como todos, donde la gente se puede ahogar.
- **Un trato nuevo**: el pueblo le ofrece a la Vecina lo que de verdad pidió, compañía de los vivos. La
  Vela se hace para siempre, por turnos, y a cambio suelta a los muertos.
- **El trato sigue**: devolvéis a Mateo al agua. Todo sigue como estaba: la suerte, la Vela y los muertos
  despiertos. Hasta que Ane muera.

```yaml
mundo:
  id: costa
  nombre: La costa que no duerme
  genero: Terror
  sinopsis: 'Nadie se ahoga en la bahía de Mareaviva desde hace treinta años, y en el pueblo eso no se celebra: se calla. Las capturas son buenas, los niños nacen sanos y por las noches algo llama desde debajo del embarcadero viejo. Aquí no se gana matando lo que hay en el agua, porque no se puede: se gana entendiendo qué se le prometió y quién lo firmó.'
  estacion: otono
  inicio: mareaviva
  presagio:
    - frase: 'Antes de que acabe la semana, alguien te pedirá que pases la noche en el embarcadero viejo.'
      se_cumple: la-vela
    - frase: 'Los papeles de un cura muerto dirán quién firmó.'
      se_cumple: la-caja-de-don-fermin
    - frase: 'En la bajamar grande, alguien bajará al Bajo a firmar otra vez.'
      se_cumple: la-bajamar
  paquete:
    world:
      levels: [1, 5]
      journey:
        days: 3
        to: Mareaviva
        how: 'Bajáis por el camino de la costa, con el mar a un lado y la niebla subiendo por los acantilados.'
      loreEntries:
        - key: Mareaviva
          type: location
          content: 'Pueblo de pescadores en una bahía cerrada por el faro al norte y el Bajo al sur. Nadie se ahoga en la bahía desde la galerna, hace treinta años.'
        - key: La Vecina
          type: other
          content: 'Lo que vive en el agua del Bajo. Los viejos la llaman así para no llamarla de otra forma. Nadie la ha visto entera.'
        - key: La Vela
          type: event
          content: 'Cada noche alguien del pueblo se sienta en la última tabla del embarcadero viejo y habla con los que suben del agua hasta que amanece.'
        - key: Desvelados
          type: other
          content: 'Los muertos de Mareaviva que se dieron al agua. No descansan: suben por los postes del embarcadero viejo cada noche.'
        - key: La galerna
          type: event
          content: 'Hace treinta años, en una noche de noviembre, salieron veintidós barcas y volvieron siete. Treinta y siete muertos.'
        - key: Braceados
          type: other
          content: 'Los nacidos en Mareaviva después del trato. Nadan mejor de lo que debería poder nadie, y en la bahía no se ahogan.'
    plot:
      chapters:
        - act: 1
          title: La suerte de Mareaviva
          summary: 'Llegas a un pueblo de pescadores donde nadie se ahoga desde hace treinta años. Una niña camina dormida hacia el mar, y el pueblo hace como que no lo ve.'
        - act: 2
          title: Las cajas de piedras
          summary: 'En el cementerio no hay muertos y la marea no baja. Alguien rompió una costumbre que nadie quiere explicar, y la cuenta la pagan los niños.'
        - act: 3
          title: Lo que se firmó
          summary: 'Hace treinta años, tres manos firmaron un trato con lo que vive en el agua. Una sigue viva, y hay quien la quiere muerta.'
        - act: 4
          title: La bajamar grande
          summary: 'Llega la marea más baja del año. Se abre el Bajo, y hay quien baja a firmar otra vez.'

faccion:
  id: cofradia
  nombre: La Cofradía de Mareaviva
  sede: mareaviva
  si_la_cumple: 'Que el trato siga y que nadie de fuera lo toque.'
  reputacion_inicial: 0

faccion:
  id: rezadoras
  nombre: Las Rezadoras
  sede: la-ermita
  si_la_cumple: 'Que sus muertos descansen, sin que el pueblo lo pague con sus niños.'
  reputacion_inicial: 0

faccion:
  id: arenales
  nombre: Los de Arenales
  sede: arenales
  si_la_cumple: 'Que el mar trate igual a los dos pueblos.'
  reputacion_inicial: -1
```
