// ProbarCampañas.exe (J16.6 de wiki/ROADMAP_SIN_CONEXION.md): el lanzador de la ventana.
//
// No hace nada más que encender tools\probar-campanas\servidor.mjs con Node, sin ventana negra;
// el servidor abre la ventana (Edge en modo aplicación) y se apaga solo al cerrarla. Si ya
// estaba encendido, la vuelve a abrir.
//
// Lo compila tools\probar-campanas\hacer-exe.mjs con el csc.exe que trae Windows (.NET Framework
// 4): sin instalar nada. Está escrito en C# 5, el que entiende ese compilador (sin $"" ni ?.).
//
// Lo que le pases al .exe se lo pasa al servidor (por ejemplo --puerto-bot 8600).

using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Windows.Forms;

[assembly: System.Reflection.AssemblyTitle("Probar campañas")]
[assembly: System.Reflection.AssemblyDescription("Un bot juega una campaña y te dice qué tal ha ido")]
[assembly: System.Reflection.AssemblyProduct("ProbarCampañas")]
[assembly: System.Reflection.AssemblyVersion("1.0.0.0")]

static class Lanzador
{
    const string Titulo = "Probar campañas";
    static readonly string Servidor = Path.Combine("tools", Path.Combine("probar-campanas", "servidor.mjs"));

    [STAThread]
    static int Main(string[] args)
    {
        string raiz = BuscarRaiz();
        if (raiz == null)
        {
            Aviso("No encuentro la carpeta del juego.\n\nProbarCampañas.exe tiene que estar en la carpeta del juego (la de Jugar.bat) o en su carpeta tools.");
            return 1;
        }
        string node = BuscarNode();
        if (node == null)
        {
            Aviso("No encuentro Node.js, y el bot lo necesita.\n\nInstálalo desde https://nodejs.org/ (la versión LTS) y vuelve a abrir ProbarCampañas.exe.");
            return 1;
        }

        StringBuilder linea = new StringBuilder(Comillas(Path.Combine(raiz, Servidor)));
        foreach (string a in args) linea.Append(' ').Append(Comillas(a));

        ProcessStartInfo info = new ProcessStartInfo(node, linea.ToString());
        info.WorkingDirectory = raiz;
        info.UseShellExecute = false;
        info.CreateNoWindow = true;
        string documentos = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
        if (!string.IsNullOrEmpty(documentos)) info.EnvironmentVariables["PROBAR_DOCUMENTOS"] = documentos;

        Process proceso;
        try
        {
            proceso = Process.Start(info);
        }
        catch (Exception e)
        {
            Aviso("No he podido encender la ventana:\n\n" + e.Message);
            return 1;
        }
        // Si se cae nada más empezar, se dice por qué (lo que haya apuntado en ventana.log).
        if (proceso.WaitForExit(4000) && proceso.ExitCode != 0)
        {
            string registro = Path.Combine(Path.Combine(documentos ?? "", "ProbarCampañas"), "ventana.log");
            string ultimo = "";
            try
            {
                string[] lineas = File.ReadAllLines(registro);
                int desde = Math.Max(0, lineas.Length - 6);
                ultimo = "\n\n" + string.Join("\n", lineas, desde, lineas.Length - desde);
            }
            catch { }
            Aviso("La ventana no ha podido arrancar (código " + proceso.ExitCode + ")." + ultimo);
            return 1;
        }
        return 0;
    }

    /// La carpeta del juego: la del .exe o una de las de encima (si está en tools).
    static string BuscarRaiz()
    {
        string dir = AppDomain.CurrentDomain.BaseDirectory;
        for (int i = 0; i < 4 && !string.IsNullOrEmpty(dir); i++)
        {
            if (File.Exists(Path.Combine(dir, Servidor))) return dir;
            DirectoryInfo arriba = Directory.GetParent(dir.TrimEnd('\\', '/'));
            dir = arriba == null ? null : arriba.FullName;
        }
        return null;
    }

    /// node.exe: en el PATH o donde lo deja su instalador.
    static string BuscarNode()
    {
        string path = Environment.GetEnvironmentVariable("PATH") ?? "";
        foreach (string trozo in path.Split(';'))
        {
            string limpio = trozo.Trim().Trim('"');
            if (limpio.Length == 0) continue;
            try
            {
                string candidato = Path.Combine(limpio, "node.exe");
                if (File.Exists(candidato)) return candidato;
            }
            catch { }
        }
        string[] sitios = {
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "nodejs\\node.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "nodejs\\node.exe"),
        };
        foreach (string s in sitios) if (File.Exists(s)) return s;
        return null;
    }

    /// Un argumento entre comillas, como lo lee Windows (las barras antes de una comilla, dobladas).
    static string Comillas(string valor)
    {
        if (valor.Length > 0 && valor.IndexOfAny(new char[] { ' ', '\t', '"' }) < 0) return valor;
        StringBuilder sb = new StringBuilder("\"");
        int barras = 0;
        foreach (char c in valor)
        {
            if (c == '\\') { barras++; continue; }
            if (c == '"') sb.Append('\\', barras * 2 + 1);
            else sb.Append('\\', barras);
            barras = 0;
            sb.Append(c);
        }
        sb.Append('\\', barras * 2).Append('"');
        return sb.ToString();
    }

    static void Aviso(string texto)
    {
        MessageBox.Show(texto, Titulo, MessageBoxButtons.OK, MessageBoxIcon.Warning);
    }
}
