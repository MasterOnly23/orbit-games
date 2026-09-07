using System;
using System.IO;
class LaunchFixture {
  static void Main() {
    File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "launch-proof.txt"), "Orbit launched this executable at " + DateTime.UtcNow.ToString("O") + "\n" + Environment.CurrentDirectory);
  }
}
