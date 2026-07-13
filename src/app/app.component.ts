import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { LinksService, Link } from './links.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  private svc = inject(LinksService);

  urlInput = '';
  links = signal<Link[]>([]);
  newLink = signal<Link | null>(null);
  error = signal<string | null>(null);
  submitting = signal(false);

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.svc.getAll().subscribe({ next: (data) => this.links.set(data) });
  }

  submit(): void {
    const url = this.urlInput.trim();
    if (!url) return;

    try {
      const { protocol } = new URL(url);
      if (protocol !== 'http:' && protocol !== 'https:') throw new Error();
    } catch {
      this.error.set('URL must start with http:// or https://');
      return;
    }

    this.error.set(null);
    this.newLink.set(null);
    this.submitting.set(true);

    this.svc.create(url).subscribe({
      next: (link) => {
        this.newLink.set(link);
        this.urlInput = '';
        this.submitting.set(false);
        this.reload();
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.error ?? 'Network error — is the backend running?');
        this.submitting.set(false);
      },
    });
  }
}
