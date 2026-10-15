import { neon } from '@neondatabase/serverless';
import { del, put } from '@vercel/blob';
import { NextResponse } from 'next/server';

function getBlobOptions() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) return { token };

  const oidcToken = process.env.VERCEL_OIDC_TOKEN;
  const storeId = process.env.BLOB_STORE_ID;
  if (oidcToken && storeId) return { oidcToken, storeId };

  throw new Error(
    'Falta la credencial de Vercel Blob. Configura BLOB_READ_WRITE_TOKEN o conecta el almacén "instrument-s-data-blob" al proyecto.',
  );
}

export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('Falta DATABASE_URL: configura la conexión a Neon.');
    }

    const sql = neon(process.env.DATABASE_URL);
    const instrumentos = await sql`
      SELECT id, usuario, instrumento, numero_parte, numero_serie, foto_url
      FROM instrumentos
      ORDER BY id DESC
    `;

    return NextResponse.json({ instrumentos });
  } catch (error) {
    console.error('Error al cargar los instrumentos:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const formData = await request.formData();

    const usuario = formData.get('usuario');
    const instrumento = formData.get('instrumento');
    const numero_parte = formData.get('numero_parte');
    const numero_serie = formData.get('numero_serie');
    const foto = formData.get('foto');

    if (!foto || typeof foto === 'string') {
      return NextResponse.json(
        { error: 'Falta la foto del instrumento' },
        { status: 400 },
      );
    }

    if (!process.env.DATABASE_URL) {
      throw new Error('Falta DATABASE_URL: configura la conexión a Neon.');
    }

    const blob = await put(`instrumentos/${Date.now()}-${foto.name}`, foto, {
      access: 'public',
      ...getBlobOptions(),
    });

    const sql = neon(process.env.DATABASE_URL);

    await sql`
      INSERT INTO instrumentos (usuario, instrumento, numero_parte, numero_serie, foto_url)
      VALUES (${usuario}, ${instrumento}, ${numero_parte}, ${numero_serie}, ${blob.url})
    `;

    return NextResponse.json({ success: true, url: blob.url }, { status: 200 });
  } catch (error) {
    console.error('Error al guardar el instrumento:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 },
    );
  }
}

export async function PATCH(request) {
  let nuevaFotoUrl = null;

  try {
    const formData = await request.formData();
    const id = String(formData.get('id') ?? '').trim();
    const instrumento = String(formData.get('instrumento') ?? '').trim();
    const numeroParte = String(formData.get('numero_parte') ?? '').trim();
    const numeroSerie = String(formData.get('numero_serie') ?? '').trim();
    const foto = formData.get('foto');
    const reemplazarFoto = foto && typeof foto !== 'string' && foto.size > 0;

    if (!id || !instrumento || !numeroParte || !numeroSerie) {
      return NextResponse.json(
        { error: 'Completa el nombre del instrumento, número de parte y número de serie.' },
        { status: 400 },
      );
    }

    if (!process.env.DATABASE_URL) {
      throw new Error('Falta DATABASE_URL: configura la conexión a Neon.');
    }

    const sql = neon(process.env.DATABASE_URL);
    const [actual] = await sql`SELECT foto_url FROM instrumentos WHERE id = ${id} LIMIT 1`;
    if (!actual) {
      return NextResponse.json({ error: 'No se encontró el instrumento.' }, { status: 404 });
    }

    let fotoUrl = actual.foto_url;
    let blobOptions;
    if (reemplazarFoto) {
      blobOptions = getBlobOptions();
      const nombreSeguro = foto.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const blob = await put(`instrumentos/${Date.now()}-${nombreSeguro}`, foto, {
        access: 'public',
        ...blobOptions,
      });
      fotoUrl = blob.url;
      nuevaFotoUrl = blob.url;
    }

    await sql`
      UPDATE instrumentos
      SET instrumento = ${instrumento},
          numero_parte = ${numeroParte},
          numero_serie = ${numeroSerie},
          foto_url = ${fotoUrl}
      WHERE id = ${id}
    `;

    if (reemplazarFoto && actual.foto_url && actual.foto_url !== fotoUrl) {
      try {
        await del(actual.foto_url, blobOptions);
      } catch (error) {
        console.warn('No se pudo eliminar la imagen anterior de Blob:', error);
      }
    }

    return NextResponse.json({ success: true, foto_url: fotoUrl });
  } catch (error) {
    if (nuevaFotoUrl) {
      try {
        await del(nuevaFotoUrl, getBlobOptions());
      } catch (cleanupError) {
        console.warn('No se pudo limpiar la imagen nueva de Blob:', cleanupError);
      }
    }

    console.error('Error al editar el instrumento:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 },
    );
  }
}

export async function DELETE(request) {
  try {
    const { id: rawId } = await request.json();
    const id = String(rawId ?? '').trim();
    if (!id) {
      return NextResponse.json({ error: 'Falta el identificador del instrumento.' }, { status: 400 });
    }

    if (!process.env.DATABASE_URL) {
      throw new Error('Falta DATABASE_URL: configura la conexión a Neon.');
    }

    const sql = neon(process.env.DATABASE_URL);
    const [instrumento] = await sql`SELECT foto_url FROM instrumentos WHERE id = ${id} LIMIT 1`;
    if (!instrumento) {
      return NextResponse.json({ error: 'No se encontró el instrumento.' }, { status: 404 });
    }

    await sql`DELETE FROM instrumentos WHERE id = ${id}`;

    if (instrumento.foto_url) {
      try {
        await del(instrumento.foto_url, getBlobOptions());
      } catch (error) {
        console.warn('No se pudo eliminar la fotografía del instrumento en Blob:', error);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar el instrumento:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 },
    );
  }
}