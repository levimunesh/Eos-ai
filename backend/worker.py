"""Background worker for import jobs. Run alongside the API: `uv run python worker.py`.

Set INLINE_JOBS=false on the API when this worker is running.
"""

import asyncio
import logging

from app.ingest.jobs import worker_loop

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    asyncio.run(worker_loop())
