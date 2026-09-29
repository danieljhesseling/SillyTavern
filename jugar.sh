#!/usr/bin/env bash
# ==========================================================================
#  jugar.sh: el juego, con un doble clic (J0.9 de ROADMAP_SIN_CONEXION).
#  Para Linux y Mac. En Windows está Jugar.bat.
#
#  1. Si el servidor ya está encendido, solo abre el navegador.
#  2. Si no, lo enciende con start.sh, que instala lo que falte y abre el
#     navegador él solo cuando el servidor está listo.
#
#  El navegador entra directo en la portada del juego: se abre sola al
#  entrar, salvo que la hayas apagado en Opciones, «Abrir el juego al entrar».
#
#  Mientras juegas, esta terminal es el servidor: si la cierras, el juego se
#  para. Para abrirlo a tus amigos, mira wiki/SERVIDOR_PRIVADO.md.
# ==========================================================================

# Siempre desde la carpeta del juego, se lance desde donde se lance.
cd "$(dirname "$0")" || exit 1

# El puerto sale de config.yaml, de la línea «port: 8000». Si no está, 8000.
PUERTO=$(grep -E '^port:' config.yaml 2>/dev/null | head -n 1 | sed -E 's/^port:[[:space:]]*([0-9]+).*/\1/')
PUERTO=${PUERTO:-8000}
# 127.0.0.1 y no localhost: es la dirección que abre el servidor, y el navegador
# guarda las opciones del juego por dirección.
DIRECCION="http://127.0.0.1:${PUERTO}/"

# Abrir el navegador: xdg-open en Linux, open en Mac.
abrir() {
    if command -v xdg-open > /dev/null; then
        xdg-open "$DIRECCION" > /dev/null 2>&1 &
    elif command -v open > /dev/null; then
        open "$DIRECCION"
    else
        echo "Abre $DIRECCION en tu navegador."
    fi
}

# ¿Ya está encendido? Se mira si alguien contesta en ese puerto.
if (exec 3<> "/dev/tcp/127.0.0.1/${PUERTO}") 2> /dev/null; then
    echo "El juego ya está encendido. Abro el navegador en $DIRECCION"
    abrir
    exit 0
fi

echo "Enciendo el juego. La primera vez tarda un poco: se instala lo que falta."
echo "El navegador se abrirá solo cuando esté listo."
echo "No cierres esta terminal mientras juegas: es el servidor."
echo
# --browserLaunchEnabled abre el navegador aunque config.yaml diga que no.
exec bash ./start.sh --browserLaunchEnabled "$@"
