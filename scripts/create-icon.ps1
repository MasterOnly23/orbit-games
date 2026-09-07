Add-Type -AssemblyName System.Drawing
$outputPath=Join-Path $PSScriptRoot '..\assets'
New-Item -ItemType Directory -Path $outputPath -Force | Out-Null
$bitmap=New-Object Drawing.Bitmap(256,256)
$g=[Drawing.Graphics]::FromImage($bitmap)
$g.SmoothingMode=[Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([Drawing.Color]::FromArgb(18,23,33))
$orange=[Drawing.Color]::FromArgb(255,129,91)
$pen=New-Object Drawing.Pen($orange,13)
$g.DrawEllipse($pen,48,48,160,160)
$g.TranslateTransform(128,128)
$g.RotateTransform(-35)
$g.DrawEllipse((New-Object Drawing.Pen([Drawing.Color]::FromArgb(240,232,224),8)),-108,-42,216,84)
$g.ResetTransform()
$g.FillEllipse((New-Object Drawing.SolidBrush($orange)),174,48,30,30)
$bitmap.Save((Join-Path $outputPath 'icon.png'),[Drawing.Imaging.ImageFormat]::Png)
$memory=New-Object IO.MemoryStream
$bitmap.Save($memory,[Drawing.Imaging.ImageFormat]::Png)
$bytes=$memory.ToArray()
$stream=[IO.File]::Create((Join-Path $outputPath 'icon.ico'))
$writer=New-Object IO.BinaryWriter($stream)
$writer.Write([uint16]0);$writer.Write([uint16]1);$writer.Write([uint16]1)
$writer.Write([byte]0);$writer.Write([byte]0);$writer.Write([byte]0);$writer.Write([byte]0)
$writer.Write([uint16]1);$writer.Write([uint16]32);$writer.Write([uint32]$bytes.Length);$writer.Write([uint32]22);$writer.Write($bytes)
$writer.Dispose();$memory.Dispose();$g.Dispose();$bitmap.Dispose()
Write-Output 'Icono creado.'
