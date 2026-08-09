/**
 * Utilitários de exportação do Modo Campo.
 */

export function slugifyFieldExportName(
  value,
) {
  return String(
    value ||
    'registro',
  )
    .normalize(
      'NFD',
    )
    .replace(
      /[\u0300-\u036f]/g,
      '',
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      '-',
    )
    .replace(
      /^-+|-+$/g,
      '',
    ) ||
    'registro';
}

export function getFieldExportDateStamp() {
  return new Date()
    .toISOString()
    .slice(
      0,
      10,
    );
}

export function downloadFieldExport({
  content,
  filename,
  mimeType,
}) {
  const blob =
    new Blob(
      [
        content,
      ],
      {
        type:
          mimeType,
      },
    );

  const url =
    URL.createObjectURL(
      blob,
    );

  const anchor =
    document.createElement(
      'a',
    );

  anchor.href =
    url;

  anchor.download =
    filename;

  document.body.appendChild(
    anchor,
  );

  anchor.click();

  anchor.remove();

  window.setTimeout(
    () => {
      URL.revokeObjectURL(
        url,
      );
    },
    0,
  );
}