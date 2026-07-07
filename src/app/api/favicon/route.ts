import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const imgType = searchParams.get('img') // 'logo', 'fantasma', 'fantasma_negro', 'fantasma_naranja'

    const workspaceRoot = 'D:\\repositorios\\sao-ciap'
    const publicImagesDir = path.join(workspaceRoot, 'public', 'images')
    const appDir = path.join(workspaceRoot, 'src', 'app')
    const oldFaviconPath = path.join(appDir, 'favicon.ico')
    const oldFaviconBackup = path.join(appDir, 'favicon.ico.bak')
    const destPath = path.join(appDir, 'icon.png')

    // Directorio de artefactos de Gemini para buscar las imágenes generadas
    const geminiArtifactsDir = 'C:\\Users\\lucas\\.gemini\\antigravity-ide\\brain\\93596b59-16ea-4511-95ec-0714aa815028'

    let sourcePath = ''
    let sourceFileName = ''

    if (imgType === 'fantasma_negro' || imgType === 'fantasma_naranja') {
      // Escanear el directorio de artefactos para encontrar el archivo generado más reciente
      if (!fs.existsSync(geminiArtifactsDir)) {
        return NextResponse.json({
          success: false,
          error: `El directorio de artefactos no existe: ${geminiArtifactsDir}`
        }, { status: 404 })
      }

      const files = fs.readdirSync(geminiArtifactsDir)
      const prefix = imgType === 'fantasma_negro' ? 'fantasma_negro_' : 'fantasma_naranja_'
      
      const matchingFiles = files
        .filter(f => f.startsWith(prefix) && f.endsWith('.png'))
        .map(f => {
          const fullPath = path.join(geminiArtifactsDir, f)
          const stat = fs.statSync(fullPath)
          return { name: f, path: fullPath, mtime: stat.mtimeMs }
        })
        .sort((a, b) => b.mtime - a.mtime) // Ordenar de más reciente a más antiguo

      if (matchingFiles.length === 0) {
        return NextResponse.json({
          success: false,
          error: `No se encontró ninguna imagen generada con el prefijo ${prefix} en ${geminiArtifactsDir}`
        }, { status: 404 })
      }

      sourcePath = matchingFiles[0].path
      sourceFileName = matchingFiles[0].name
    } else if (imgType === 'fantasma') {
      sourcePath = path.join(publicImagesDir, 'fantasma.png')
      sourceFileName = 'fantasma.png'
    } else {
      sourcePath = path.join(publicImagesDir, 'sao-logo.png')
      sourceFileName = 'sao-logo.png'
    }

    // 1. Verificar si el archivo origen existe
    if (!fs.existsSync(sourcePath)) {
      return NextResponse.json({
        success: false,
        error: `El archivo origen no existe en la ruta: ${sourcePath}`
      }, { status: 400 })
    }

    // 2. Renombrar o eliminar el favicon antiguo si existe para evitar conflictos
    if (fs.existsSync(oldFaviconPath)) {
      if (fs.existsSync(oldFaviconBackup)) {
        fs.unlinkSync(oldFaviconPath)
      } else {
        fs.renameSync(oldFaviconPath, oldFaviconBackup)
      }
    }

    // 3. Copiar la imagen al destino
    fs.copyFileSync(sourcePath, destPath)

    // Opcional: copiar la imagen generada al directorio public/images para que esté disponible localmente
    if (imgType === 'fantasma_negro' || imgType === 'fantasma_naranja') {
      const targetPublicPath = path.join(publicImagesDir, `${imgType}.png`)
      fs.copyFileSync(sourcePath, targetPublicPath)
    }

    return NextResponse.json({
      success: true,
      message: `Se copió con éxito ${sourceFileName} a src/app/icon.png y se desactivó el favicon anterior.`
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
