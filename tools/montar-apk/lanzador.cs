// MontarAPK.exe: el lanzador para montar y compilar la APK de Dnd Master
//
// Enciende tools\montar-apk\servidor.mjs con Node, sin consola negra; el servidor
// abre la ventana de la aplicación (Edge en modo app) y se apaga al cerrarla.
// Lo compila tools\montar-apk\hacer-exe.mjs con csc.exe del .NET Framework 4.

using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Windows.Forms;

[assembly: System.Reflection.AssemblyTitle("Montar APK")]
[assembly: System.Reflection.AssemblyDescription("Montar y compilar la APK de Dnd Master para Android")]
[assembly: System.Reflection.AssemblyProduct("MontarAPK")]
[assembly: System.Reflection.AssemblyVersion("1.0.0.0")]

static class Lanzador
{
    const string Titulo = "Montar APK — Dnd Master";
    static readonly string Servidor = Path.Combine("tools", Path.Combine("montar-apk", "servidor.mjs"));

    [STAThread]
    static int Main(string[] args)
    {
        string raiz = BuscarRaiz();
        if (raiz == null)
        {
            Aviso("No encuentro la carpeta del juego.\n\nMontarAPK.exe tiene que estar en la carpeta del juego o en su carpeta tools.");
            return 1;
        }
        string node = BuscarNode();
        if (node == null)
        {
            Aviso("No encuentro Node.js, y hace falta para empaquetar la APK.\n\nInstálalo desde https://nodejs.org/ (la versión LTS) y vuelve a abrir MontarAPK.exe.");
            return 1;
        }

        StringBuilder linea = new StringBuilder(Comillas(Path.Combine(raiz, Servidor)));
        foreach (string a in args) linea.Append(' ').Append(Comillas(a));

        ProcessStartInfo info = new ProcessStartInfo(node, linea.ToString());
        info.WorkingDirectory = raiz;
        info.UseShellExecute = false;
        info.CreateNoWindow = true;

        Process proceso;
        try
        {
            proceso = Process.Start(info);
        }
        catch (Exception e)
        {
            Aviso("No he podido encender la ventana de montaje:\n\n" + e.Message);
            return 1;
        }

        if (proceso.WaitForExit(4000) && proceso.ExitCode != 0)
        {
            string registro = Path.Combine(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MontarAPK"), "ventana.log");
            string ultimo = "";
            try
            {
                string[] lineas = File.ReadAllLines(registro);
                int desde = Math.Max(0, lineas.Length - 6);
                ultimo = "\n\n" + string.Join("\n", lineas, desde, lineas.Length - desde);
            }
            catch { }
            Aviso("La ventana de montaje no ha podido arrancar (código " + proceso.ExitCode + ")." + ultimo);
            return 1;
        }
        return 0;
    }

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
