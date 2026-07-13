import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Link {
  code: string;
  url: string;
  shortUrl: string;
  hits: number;
  createdAt: string;
}

const API = 'http://localhost:3000/api/links';

@Injectable({ providedIn: 'root' })
export class LinksService {
  private http = inject(HttpClient);

  getAll(): Observable<Link[]> {
    return this.http.get<Link[]>(API);
  }

  create(url: string): Observable<Link> {
    return this.http.post<Link>(API, { url });
  }
}
