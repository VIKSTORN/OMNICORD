package dev.beefers.vendetta.manager.ui.widgets.dialog

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import kotlinx.coroutines.delay

@Composable
fun EndOfLifeDialog(onDismiss: () -> Unit) {
    var secondsLeft by remember { mutableIntStateOf(5) }
    val canDismiss = secondsLeft <= 0

    LaunchedEffect(secondsLeft) {
        if (secondsLeft > 0) {
            delay(1000L)
            secondsLeft--
        }
    }

    val maybeOnDismiss = { if (canDismiss) onDismiss() }

    val linkColor = MaterialTheme.colorScheme.primary
    val message = remember(linkColor) {
        buildAnnotatedString {
            append("Kettu will no longer get updates for newer discord versions, we recommend switching to ")
            withLink(
                LinkAnnotation.Url(
                    url = "https://valenced.app",
                    styles = TextLinkStyles(
                        style = SpanStyle(
                            color = linkColor,
                            textDecoration = TextDecoration.Underline,
                            fontWeight = FontWeight.Medium
                        )
                    )
                )
            ) {
                append("Valenced")
            }
        }
    }

    AlertDialog(
        onDismissRequest = maybeOnDismiss,
        title = { Text(text = "Project Unmaintained") },
        text = { Text(text = message) },
        icon = {
            Icon(Icons.Filled.Warning, contentDescription = null)
        },
        confirmButton = {
            FilledTonalButton(
                enabled = canDismiss,
                onClick = maybeOnDismiss,
            ) {
                Text(text = "Understood${if (!canDismiss) " ($secondsLeft)" else ""}")
            }
        }
    )
}
