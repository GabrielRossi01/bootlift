package dev.rossi.billing.invoice;

import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/invoices")
public class InvoiceController {

    private final InvoiceSigner signer;

    public InvoiceController(InvoiceSigner signer) {
        this.signer = signer;
    }

    @PostMapping("/sign")
    public Map<String, String> sign(@Valid @RequestBody Invoice invoice) throws Exception {
        return Map.of("signature", signer.sign(invoice));
    }
}
