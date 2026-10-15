'use client';

import { useCallback, useEffect, useState } from 'react';

export default function Home() {
  const [instrumentos, setInstrumentos] = useState([]);
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [editando, setEditando] = useState(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState('');
  const [confirmarEliminacion, setConfirmarEliminacion] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  const cargarInstrumentos = useCallback(async () => {
    const response = await fetch('/api/instrumentos', { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo cargar el inventario.');
    setInstrumentos(result.instrumentos);
  }, []);

  useEffect(() => {
    let activo = true;
    fetch('/api/instrumentos', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'No se pudo cargar el inventario.');
        if (activo) setInstrumentos(result.instrumentos);
      })
      .catch((error) => {
        if (activo) setMensaje(error instanceof Error ? error.message : 'No se pudo cargar el inventario.');
      })
      .finally(() => {
        if (activo) setCargandoLista(false);
      });

    return () => {
      activo = false;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setCargando(true);
    setMensaje('');

    try {
      const response = await fetch('/api/instrumentos', {
        method: 'POST',
        body: new FormData(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo guardar el instrumento.');

      form.reset();
      setMensaje('Instrumento guardado correctamente.');
      setCargandoLista(true);
      await cargarInstrumentos();
    } catch (error) {
      setMensaje(error instanceof Error ? error.message : 'Ocurrió un error al guardar el instrumento.');
    } finally {
      setCargandoLista(false);
      setCargando(false);
    }
  }

  async function handleEditSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setGuardandoEdicion(true);
    setErrorEdicion('');

    try {
      const formData = new FormData(form);
      formData.set('id', String(editando.id));
      const response = await fetch('/api/instrumentos', {
        method: 'PATCH',
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo actualizar el instrumento.');

      setEditando(null);
      setMensaje('Instrumento actualizado correctamente.');
      setCargandoLista(true);
      await cargarInstrumentos();
    } catch (error) {
      setErrorEdicion(error instanceof Error ? error.message : 'No se pudo actualizar el instrumento.');
    } finally {
      setCargandoLista(false);
      setGuardandoEdicion(false);
    }
  }

  async function handleDelete() {
    if (!editando) return;
    setEliminando(true);
    setErrorEdicion('');

    try {
      const response = await fetch('/api/instrumentos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editando.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo eliminar el instrumento.');

      setEditando(null);
      setConfirmarEliminacion(false);
      setMensaje('Instrumento eliminado correctamente.');
      setCargandoLista(true);
      await cargarInstrumentos();
    } catch (error) {
      setErrorEdicion(error instanceof Error ? error.message : 'No se pudo eliminar el instrumento.');
    } finally {
      setCargandoLista(false);
      setEliminando(false);
    }
  }

  return (
    <main className="inventory-layout">
      <aside className="form-sidebar">
        <div className="brand-mark" aria-hidden="true">ID</div>
        <p className="eyebrow">Control de laboratorio</p>
        <h1>Registro de instrumentos</h1>
        <p className="sidebar-copy">Añade un instrumento al inventario y conserva su información en un solo lugar.</p>

        <form className="instrument-form" onSubmit={handleSubmit}>
          <label htmlFor="usuario">Usuario / persona que carga</label>
          <input id="usuario" type="text" name="usuario" placeholder="Nombre completo" required />

          <label htmlFor="instrumento">Instrumento</label>
          <input id="instrumento" type="text" name="instrumento" placeholder="Ej. Multímetro digital" required />

          <div className="field-row">
            <div className="field-group">
              <label htmlFor="numero_parte">Número de parte</label>
              <input id="numero_parte" type="text" name="numero_parte" placeholder="N.º de parte" required />
            </div>
            <div className="field-group">
              <label htmlFor="numero_serie">Número de serie</label>
              <input id="numero_serie" type="text" name="numero_serie" placeholder="N.º de serie" required />
            </div>
          </div>

          <label htmlFor="foto">Foto del instrumento</label>
          <input id="foto" className="file-input" type="file" name="foto" accept="image/*" required />

          <button className="submit-button" type="submit" disabled={cargando}>
            {cargando ? 'Guardando…' : '＋  Guardar instrumento'}
          </button>
        </form>
        {mensaje && <p className="feedback" role="status">{mensaje}</p>}
        <p className="sidebar-footnote">Los campos marcados son obligatorios.</p>
      </aside>

      <section className="catalog-area" aria-labelledby="catalog-title">
        <header className="catalog-header">
          <div>
            <p className="eyebrow">Inventario</p>
            <h2 id="catalog-title">Instrumentos guardados</h2>
            <p className="catalog-description">Consulta los equipos registrados y sus fotografías.</p>
          </div>
          <div className="count-pill"><span>{instrumentos.length}</span> {instrumentos.length === 1 ? 'instrumento' : 'instrumentos'}</div>
        </header>

        {cargandoLista ? (
          <div className="empty-state"><span className="loader" aria-hidden="true" />Cargando inventario…</div>
        ) : instrumentos.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon" aria-hidden="true">▧</span>
            <h3>Aún no hay instrumentos</h3>
            <p>Completa el formulario para agregar el primer equipo al inventario.</p>
          </div>
        ) : (
          <div className="instrument-grid">
            {instrumentos.map((item) => (
              <article className="instrument-card" key={item.id}>
                <div className="instrument-image-wrap">
                  {item.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="instrument-image" src={item.foto_url} alt={`Foto de ${item.instrumento}`} loading="lazy" />
                  ) : (
                    <div className="image-placeholder">Sin fotografía</div>
                  )}
                  <span className="image-tag">Equipo</span>
                </div>
                <div className="card-content">
                  <p className="card-part">PARTE {item.numero_parte}</p>
                  <h3>{item.instrumento}</h3>
                  <dl className="instrument-details">
                    <div><dt>Número de serie</dt><dd>{item.numero_serie}</dd></div>
                    <div><dt>Registrado por</dt><dd>{item.usuario}</dd></div>
                  </dl>
                  <button
                    className="edit-button"
                    type="button"
                    onClick={() => {
                      setErrorEdicion('');
                      setConfirmarEliminacion(false);
                      setEditando(item);
                    }}
                  >
                    Editar instrumento
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {editando && (
        <div className="modal-backdrop">
          <section className="edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-title">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Actualizar inventario</p>
                <h2 id="edit-title">Editar instrumento</h2>
              </div>
              <button
                className="modal-close"
                type="button"
                aria-label="Cerrar edición"
                onClick={() => {
                  setEditando(null);
                  setConfirmarEliminacion(false);
                }}
                disabled={guardandoEdicion || eliminando}
              >
                ×
              </button>
            </div>

            <form className="edit-form" onSubmit={handleEditSubmit}>
              <label htmlFor="edit-instrumento">Nombre del instrumento</label>
              <input id="edit-instrumento" name="instrumento" type="text" defaultValue={editando.instrumento} required />

              <div className="field-row">
                <div className="field-group">
                  <label htmlFor="edit-parte">Número de parte</label>
                  <input id="edit-parte" name="numero_parte" type="text" defaultValue={editando.numero_parte} required />
                </div>
                <div className="field-group">
                  <label htmlFor="edit-serie">Número de serie</label>
                  <input id="edit-serie" name="numero_serie" type="text" defaultValue={editando.numero_serie} required />
                </div>
              </div>

              <div className="current-photo">
                {editando.foto_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={editando.foto_url} alt={`Foto actual de ${editando.instrumento}`} />
                ) : (
                  <span>Sin fotografía actual</span>
                )}
              </div>
              <label htmlFor="edit-foto">Foto del instrumento</label>
              <input id="edit-foto" className="modal-file-input" name="foto" type="file" accept="image/*" />
              <p className="file-hint">Selecciona una imagen solo si deseas reemplazar la actual.</p>

              {errorEdicion && <p className="edit-error" role="alert">{errorEdicion}</p>}

              <div className="modal-actions">
                <button className="cancel-button" type="button" onClick={() => setEditando(null)} disabled={guardandoEdicion || eliminando}>Cancelar</button>
                <button className="save-edit-button" type="submit" disabled={guardandoEdicion || eliminando}>
                  {guardandoEdicion ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </form>
            <div className="delete-area">
              {confirmarEliminacion ? (
                <div className="delete-confirm" role="alertdialog" aria-label="Confirmar eliminación">
                  <p>¿Seguro que deseas eliminar <strong>{editando.instrumento}</strong>? Esta acción no se puede deshacer.</p>
                  <div className="modal-actions">
                    <button className="cancel-button" type="button" onClick={() => setConfirmarEliminacion(false)} disabled={eliminando}>No, conservar</button>
                    <button className="confirm-delete-button" type="button" onClick={handleDelete} disabled={eliminando}>
                      {eliminando ? 'Eliminando…' : 'Sí, eliminar'}
                    </button>
                  </div>
                </div>
              ) : (
                <button className="delete-instrument-button" type="button" onClick={() => setConfirmarEliminacion(true)} disabled={guardandoEdicion || eliminando}>
                  Eliminar instrumento
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}