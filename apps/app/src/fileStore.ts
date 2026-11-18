// spec/app/files.md, "Saving one attachment or all selected photos is one acknowledged local transaction"
type Bytes = { readonly mimeType: string; readonly data: string };

const catalogKey = "catalog";

function answered<A>(request: IDBRequest<A>) {
  return new Promise<A>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("The file library could not be read", { cause: request.error }));
  });
}

function library() {
  const request = indexedDB.open("grace-files", 1);
  request.onupgradeneeded = () => {
    request.result.createObjectStore("content");
    request.result.createObjectStore("catalog");
  };
  return answered(request);
}

export async function catalog(): Promise<unknown> {
  const db = await library();
  try {
    return await answered(db.transaction("catalog").objectStore("catalog").get(catalogKey));
  } finally {
    db.close();
  }
}

export async function commit(content: ReadonlyMap<string, Bytes>, entries: unknown): Promise<void> {
  const db = await library();
  try {
    const t = db.transaction(["content", "catalog"], "readwrite");
    const done = new Promise<void>((resolve, reject) => {
      t.oncomplete = () => resolve();
      t.onabort = () => reject(new Error("The file library did not change", { cause: t.error }));
    });
    for (const [id, bytes] of content) t.objectStore("content").put(bytes, id);
    t.objectStore("catalog").put(entries, catalogKey);
    await done;
  } finally {
    db.close();
  }
}
