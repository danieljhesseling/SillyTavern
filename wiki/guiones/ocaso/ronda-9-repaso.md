# Las tierras del ocaso — ronda 9: el repaso tras la primera vuelta

> Escrita por Claude (tanda 20, 2026-10-03), después de jugarla entera con `node tools/vuelta-campana.mjs` (puerto 8602). Lo que se corrige va aquí, encima de lo escrito: el conversor mezcla cada bloque con el del mismo id.

## La puerta del patio de la Atalaya

En la primera vuelta, el grupo derrotó al capitán del Cierzo pero no llegó al fanal: la puerta enana entre el patio y la plataforma estaba cerrada, y el objetivo «Encender el fanal» quedaba detrás. Ahora la puerta está abierta: el capitán la dejó así para que subas a por él («Sube a por mí, si puedes»), y el guardián de hierro sigue delante, guardándola.

tablero:
  id: t-atalaya
  mapa:
    - "######################"
    - "#vvvvv^^^^^^^^^^vvvvv#"
    - "#vvvvv^........^vvvvv#"
    - "#vvvvv^...^^...^vvvvv#"
    - "#vvvvv####oo####vvvvv#"
    - "#v..................v#"
    - "#v..c....T..T....c..v#"
    - "#v.....##....##.....v#"
    - "#v..C..##....##..C..v#"
    - "#v..................v#"
    - "#v......~~~~~~......v#"
    - "#v..................v#"
    - "######################"

encuentro:
  id: enc-atalaya
  nota: "Acto 4, el final. Para nivel 5, y duro. La puerta enana de la plataforma está abierta, pero el guardián de hierro la guarda; el capitán espera arriba, junto al fanal. Los bordes del patio dan al vacío."
